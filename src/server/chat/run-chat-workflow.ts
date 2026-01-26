import { randomUUID } from "node:crypto";

import { Annotation, END, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";

import type { ChatRequest } from "../schemas.js";
import type { LlmConfig } from "../llm/env-models.js";
import { loadLlmConfig } from "../llm/env-models.js";
import { OpenAICompatibleClient } from "../llm/openai-compatible.js";
import { retrieveResources } from "../tools/resources.js";
import { webSearch } from "../tools/web-search.js";
import {
  buildFallbackPlan,
  buildPlannerEditPrompt,
  buildPlannerPrompt,
  buildReporterPrompt,
  safeParsePlan,
} from "../workflow.js";
import type { ThreadStore } from "../runtime/thread-store.js";
import type { WorkflowState } from "../runtime/types.js";

type ChatEvent = {
  type: string;
  data: Record<string, unknown>;
};

type ToolCall = {
  type: "tool_call";
  id: string;
  name: string;
  args: Record<string, unknown>;
};

type ToolCallChunk = {
  type: "tool_call_chunk";
  index: number;
  id: string;
  name: string;
  args: string;
};

function newMessageId(): string {
  return `run-${randomUUID()}`;
}

function newToolCallId(): string {
  return `call_${randomUUID().replace(/-/g, "")}`;
}

function stripThinkTags(text: string): string {
  return text.replaceAll("<think>", "").replaceAll("</think>", "");
}

function pickLlmConfig(params: { enableDeepThinking: boolean }): LlmConfig | null {
  if (params.enableDeepThinking) {
    return loadLlmConfig("reasoning") ?? loadLlmConfig("basic");
  }
  return loadLlmConfig("basic") ?? loadLlmConfig("reasoning");
}

function normalizeUserContent(request: ChatRequest): string {
  const lastUser = [...request.messages].reverse().find((m) => m.role === "user") ?? request.messages.at(-1);
  if (!lastUser) return "";
  if (typeof lastUser.content === "string") return lastUser.content;
  return lastUser.content.map((c) => c.text ?? "").join("");
}

type CoordinatorDecision =
  | { action: "direct_response"; message: string }
  | { action: "handoff_to_planner" };

function isChineseLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

function isLikelyChitChat(userText: string): boolean {
  const trimmed = userText.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))[^a-z0-9]*$/i.test(trimmed)) return true;
  if (/^(你好|您好|嗨|哈喽|早上好|上午好|中午好|下午好|晚上好|在吗)[！!。,.?？]*$/.test(trimmed)) return true;

  if (lower.length <= 50) {
    if (/(what\s+can\s+you\s+do|who\s+are\s+you|your\s+name)/.test(lower)) return true;
    if (/(你是谁|你叫什么|你能做什么|你会什么|你是什么)/.test(trimmed)) return true;
  }

  return false;
}

function defaultChitChatReply(params: { locale: string; userText: string }): string {
  if (isChineseLocale(params.locale)) {
    return "你好！我在这里。你想聊点什么，还是需要我帮你做检索/分析/写作？";
  }
  return "Hi! How can I help you today?";
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const end = text.lastIndexOf("}");
  if (end <= start) return null;
  return text.slice(start, end + 1);
}

function parseCoordinatorDecision(text: string): CoordinatorDecision | null {
  const trimmed = text.trim();
  const direct = tryParseJsonObject(trimmed) ?? tryParseJsonObject(extractFirstJsonObject(trimmed) ?? "");
  if (!direct) return null;

  const action = direct.action;
  if (action === "handoff_to_planner") return { action: "handoff_to_planner" };
  if (action !== "direct_response") return null;

  const message = direct.message;
  if (typeof message !== "string" || !message.trim()) return null;

  return { action: "direct_response", message };
}

async function decideCoordinatorAction(params: {
  llm: OpenAICompatibleClient | null;
  locale: string;
  userText: string;
  signal?: AbortSignal;
}): Promise<CoordinatorDecision> {
  if (!params.llm) {
    if (isLikelyChitChat(params.userText)) {
      return {
        action: "direct_response",
        message: defaultChitChatReply({ locale: params.locale, userText: params.userText }),
      };
    }
    return { action: "handoff_to_planner" };
  }

  const system =
    "You are DeerFlow Coordinator. Decide whether to respond directly or hand off to the planner. " +
    "You MUST respond directly for greetings, small talk, identity/capability questions (e.g., 'who are you', 'what can you do'). " +
    "You MUST hand off for research/factual/information requests. " +
    'Output ONLY valid JSON (no markdown). Schema: {"action":"direct_response"|"handoff_to_planner","message"?:string}. ' +
    "When action=direct_response, message is required and must be in the user's language.";

  const user = `Locale: ${params.locale}\nUser message: ${params.userText}`;

  let out = "";
  try {
    for await (const delta of params.llm.streamChatCompletions({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(params.signal ? { signal: params.signal } : {}),
    })) {
      if (delta.content) out += delta.content;
      if (delta.finishReason) break;
    }
  } catch {
    return { action: "handoff_to_planner" };
  }

  return parseCoordinatorDecision(out) ?? { action: "handoff_to_planner" };
}

function makeBaseState(params: {
  request: ChatRequest;
  threadId: string;
  query: string;
}): WorkflowState {
  const { request, threadId, query } = params;
  return {
    threadId,
    locale: request.locale,
    researchTopic: query,
    messages: [{ role: "user", content: query }],
    resources: request.resources,
    observations: [],
    planIterations: 0,
    currentPlan: null,
    backgroundInvestigationResults: null,
    enableBackgroundInvestigation: request.enable_background_investigation,
    enableWebSearch: request.enable_web_search,
    maxPlanIterations: request.max_plan_iterations,
    maxStepNum: request.max_step_num,
    maxSearchResults: request.max_search_results,
    autoAcceptedPlan: request.auto_accepted_plan,
    reportStyle: request.report_style,
  };
}

function upsertThreadState(params: {
  store: ThreadStore;
  request: ChatRequest;
  query: string;
  isFeedback: boolean;
}): WorkflowState {
  const threadId = params.request.thread_id;
  const existing = params.store.get(threadId);
  if (!existing) {
    const created = makeBaseState({
      request: params.request,
      threadId,
      query: params.query,
    });
    params.store.set(created);
    return created;
  }

  const merged: WorkflowState = {
    ...existing,
    locale: params.request.locale,
    enableBackgroundInvestigation: params.request.enable_background_investigation,
    enableWebSearch: params.request.enable_web_search,
    maxPlanIterations: params.request.max_plan_iterations,
    maxStepNum: params.request.max_step_num,
    maxSearchResults: params.request.max_search_results,
    autoAcceptedPlan: params.request.auto_accepted_plan,
    reportStyle: params.request.report_style,
    resources: params.request.resources.length ? params.request.resources : existing.resources,
    ...(params.isFeedback
      ? {}
      : {
          researchTopic: params.query,
          messages: [...existing.messages, { role: "user", content: params.query }],
          observations: [],
          planIterations: 0,
          currentPlan: null,
          backgroundInvestigationResults: null,
        }),
  };
  params.store.set(merged);
  return merged;
}

type PlanningGraphState = WorkflowState & {
  incomingText: string;
  interruptFeedback: ChatRequest["interrupt_feedback"];
  isFeedback: boolean;
  coordinatorAction: "direct_response" | "handoff_to_planner" | null;
  plannerShouldInterrupt: boolean;
  done: "none" | "direct_response" | "interrupt_ready";
};

export async function* runChatWorkflow(params: {
  request: ChatRequest;
  store: ThreadStore;
  signal?: AbortSignal;
}): AsyncIterable<ChatEvent> {
  const { request, store, signal } = params;
  const incomingText = normalizeUserContent(request);

  const isFeedback = request.interrupt_feedback === "accepted" || request.interrupt_feedback === "edit_plan";
  const existing = store.get(request.thread_id);
  const query = isFeedback ? (existing?.researchTopic ?? incomingText) : incomingText;

  let state = upsertThreadState({ store, request, query, isFeedback });

  const llmCfg = pickLlmConfig({ enableDeepThinking: request.enable_deep_thinking });
  const llm = llmCfg ? new OpenAICompatibleClient(llmCfg) : null;

  const PlanningState = Annotation.Root({
    threadId: Annotation<string>(),
    locale: Annotation<string>(),
    researchTopic: Annotation<string>(),
    messages: Annotation<WorkflowState["messages"]>(),
    resources: Annotation<WorkflowState["resources"]>(),
    observations: Annotation<WorkflowState["observations"]>(),
    planIterations: Annotation<number>(),
    currentPlan: Annotation<WorkflowState["currentPlan"]>(),
    backgroundInvestigationResults: Annotation<WorkflowState["backgroundInvestigationResults"]>(),
    enableBackgroundInvestigation: Annotation<boolean>(),
    enableWebSearch: Annotation<boolean>(),
    maxPlanIterations: Annotation<number>(),
    maxStepNum: Annotation<number>(),
    maxSearchResults: Annotation<number>(),
    autoAcceptedPlan: Annotation<boolean>(),
    reportStyle: Annotation<WorkflowState["reportStyle"]>(),
    incomingText: Annotation<string>(),
    interruptFeedback: Annotation<ChatRequest["interrupt_feedback"]>(),
    isFeedback: Annotation<boolean>(),
    coordinatorAction: Annotation<PlanningGraphState["coordinatorAction"]>(),
    plannerShouldInterrupt: Annotation<boolean>(),
    done: Annotation<PlanningGraphState["done"]>(),
  });

  const emit = (config: LangGraphRunnableConfig | undefined, event: ChatEvent) => {
    config?.writer?.(event);
  };

  const coordinatorNode = async (s: PlanningGraphState, config?: LangGraphRunnableConfig) => {
    if (s.isFeedback) {
      return { coordinatorAction: "handoff_to_planner" as const };
    }

    if (s.resources.length > 0) {
      const coordinatorId = newMessageId();
      const content = isChineseLocale(s.locale)
        ? "收到。我会先制定一个研究计划，然后开始检索与撰写报告。"
        : "Got it. I'll draft a research plan first, then gather sources and write up the report.";

      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: s.threadId,
          id: coordinatorId,
          agent: "coordinator",
          role: "assistant",
          content,
        },
      });
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: s.threadId,
          id: coordinatorId,
          agent: "coordinator",
          role: "assistant",
          finish_reason: "stop",
        },
      });

      return { coordinatorAction: "handoff_to_planner" as const };
    }

    const decision = await decideCoordinatorAction({
      llm,
      locale: s.locale,
      userText: s.incomingText,
      ...(config?.signal ? { signal: config.signal } : {}),
    });

    const coordinatorId = newMessageId();
    if (decision.action === "direct_response") {
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: s.threadId,
          id: coordinatorId,
          agent: "coordinator",
          role: "assistant",
          content: decision.message,
        },
      });
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: s.threadId,
          id: coordinatorId,
          agent: "coordinator",
          role: "assistant",
          finish_reason: "stop",
        },
      });
      return { coordinatorAction: "direct_response" as const, done: "direct_response" as const };
    }

    const content = isChineseLocale(s.locale)
      ? "收到。我会先制定一个研究计划，然后开始检索与撰写报告。"
      : "Got it. I'll draft a research plan first, then gather sources and write up the report.";

    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: coordinatorId,
        agent: "coordinator",
        role: "assistant",
        content,
      },
    });
    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: coordinatorId,
        agent: "coordinator",
        role: "assistant",
        finish_reason: "stop",
      },
    });

    return { coordinatorAction: "handoff_to_planner" as const };
  };

  const backgroundInvestigatorNode = async (s: PlanningGraphState, config?: LangGraphRunnableConfig) => {
    const shouldPlan = !s.interruptFeedback || s.interruptFeedback === "edit_plan";
    if (!shouldPlan) return {};
    if (!s.enableBackgroundInvestigation || !s.enableWebSearch) return {};

    const toolCallId = newToolCallId();
    const researcherId = newMessageId();
    const toolCalls: ToolCall[] = [
      {
        type: "tool_call",
        id: toolCallId,
        name: "web_search",
        args: { query: s.researchTopic, max_results: s.maxSearchResults },
      },
    ];
    const toolCallChunks: ToolCallChunk[] = [
      {
        type: "tool_call_chunk",
        index: 0,
        id: toolCallId,
        name: "web_search",
        args: JSON.stringify(toolCalls[0]!.args),
      },
    ];

    emit(config, {
      type: "tool_calls",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        tool_calls: toolCalls,
        tool_call_chunks: toolCallChunks,
      },
    });
    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        finish_reason: "tool_calls",
      },
    });

    let content = "";
    try {
      const results = await webSearch({
        query: s.researchTopic,
        maxResults: s.maxSearchResults,
        ...(config?.signal ? { signal: config.signal } : {}),
      });
      content = results.length
        ? results
            .map((r, i) => `- [${i + 1}] ${r.title} (${r.url})${r.content ? `\n  ${r.content}` : ""}`)
            .join("\n")
        : "(no search results)";
    } catch (e) {
      content = e instanceof Error ? e.message : String(e);
    }

    emit(config, {
      type: "tool_call_result",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "tool",
        tool_call_id: toolCallId,
        content,
      },
    });

    store.set({ ...(s as WorkflowState), backgroundInvestigationResults: content });

    return { backgroundInvestigationResults: content };
  };

  const plannerNode = async (s: PlanningGraphState, config?: LangGraphRunnableConfig) => {
    const shouldPlan = !s.interruptFeedback || s.interruptFeedback === "edit_plan";
    if (!shouldPlan) {
      return { plannerShouldInterrupt: false, done: "none" as const };
    }

    let next: WorkflowState = s;

    const plannerId = newMessageId();
    const isEditing = s.interruptFeedback === "edit_plan";
    const prompt =
      isEditing && next.currentPlan
        ? buildPlannerEditPrompt({
            locale: next.locale,
            query: next.researchTopic,
            currentPlan: next.currentPlan,
            instruction: s.incomingText,
            maxSteps: next.maxStepNum,
            enableWebSearch: next.enableWebSearch,
            backgroundInvestigationResults: next.backgroundInvestigationResults,
          })
        : buildPlannerPrompt({
            query: next.researchTopic,
            locale: next.locale,
            maxSteps: next.maxStepNum,
            enableWebSearch: next.enableWebSearch,
            backgroundInvestigationResults: next.backgroundInvestigationResults,
          });

    if (!llm) {
      const plan = buildFallbackPlan({
        query: next.researchTopic,
        maxSteps: next.maxStepNum,
        enableWebSearch: next.enableWebSearch,
      });
      const planText = JSON.stringify(plan, null, 2);
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: next.threadId,
          id: plannerId,
          agent: "planner",
          role: "assistant",
          content: planText,
        },
      });
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: next.threadId,
          id: plannerId,
          agent: "planner",
          role: "assistant",
          finish_reason: "stop",
        },
      });
      next = { ...next, currentPlan: plan, planIterations: next.planIterations + 1 };
      store.set(next);
    } else {
      let fullText = "";

      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: next.threadId,
          id: plannerId,
          agent: "planner",
          role: "assistant",
          reasoning_content: "Planning…",
        },
      });

      try {
        for await (const delta of llm.streamChatCompletions({
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          ...(config?.signal ? { signal: config.signal } : {}),
        })) {
          if (delta.reasoningContent) {
            emit(config, {
              type: "message_chunk",
              data: {
                thread_id: next.threadId,
                id: plannerId,
                agent: "planner",
                role: "assistant",
                reasoning_content: delta.reasoningContent,
              },
            });
          }
          if (delta.content) {
            fullText += stripThinkTags(delta.content);
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        emit(config, {
          type: "message_chunk",
          data: {
            thread_id: next.threadId,
            id: plannerId,
            agent: "planner",
            role: "assistant",
            reasoning_content: `Planner stream failed: ${message}`,
          },
        });
      }

      const parsedPlan =
        safeParsePlan(fullText) ??
        buildFallbackPlan({
          query: next.researchTopic,
          maxSteps: next.maxStepNum,
          enableWebSearch: next.enableWebSearch,
        });

      const json = JSON.stringify(parsedPlan, null, 2);
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: next.threadId,
          id: plannerId,
          agent: "planner",
          role: "assistant",
          content: json,
        },
      });

      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: next.threadId,
          id: plannerId,
          agent: "planner",
          role: "assistant",
          finish_reason: "stop",
        },
      });

      next = { ...next, currentPlan: parsedPlan, planIterations: next.planIterations + 1 };
      store.set(next);
    }

    const shouldRun = next.autoAcceptedPlan || s.interruptFeedback === "accepted";
    if (!shouldRun) {
      return { plannerShouldInterrupt: true, done: "interrupt_ready" as const };
    }

    return {
      plannerShouldInterrupt: false,
      done: "none" as const,
      currentPlan: next.currentPlan,
      planIterations: next.planIterations,
      backgroundInvestigationResults: next.backgroundInvestigationResults,
    };
  };

  const humanFeedbackNode = async (s: PlanningGraphState, config?: LangGraphRunnableConfig) => {
    if (!s.plannerShouldInterrupt) return {};
    const interruptId = `human_feedback:${randomUUID()}`;
    emit(config, {
      type: "interrupt",
      data: {
        thread_id: s.threadId,
        id: interruptId,
        agent: "planner",
        role: "assistant",
        finish_reason: "interrupt",
        options: [
          { text: "Edit plan", value: "edit_plan" },
          { text: "Start research", value: "accepted" },
        ],
      },
    });
    return {};
  };

  const planningGraph = new StateGraph(PlanningState)
    .addNode("coordinator", coordinatorNode)
    .addNode("background_investigator", backgroundInvestigatorNode)
    .addNode("planner", plannerNode)
    .addNode("human_feedback", humanFeedbackNode)
    .addEdge(START, "coordinator")
    .addConditionalEdges("coordinator", (s: PlanningGraphState) => {
      if (s.coordinatorAction === "direct_response") return END;
      const shouldPlan = !s.interruptFeedback || s.interruptFeedback === "edit_plan";
      if (shouldPlan && s.enableBackgroundInvestigation && s.enableWebSearch) return "background_investigator";
      return "planner";
    })
    .addEdge("background_investigator", "planner")
    .addConditionalEdges("planner", (s: PlanningGraphState) => {
      return s.plannerShouldInterrupt ? "human_feedback" : END;
    })
    .addEdge("human_feedback", END)
    .compile();

  let finalPlanningState: PlanningGraphState = {
    ...state,
    incomingText,
    interruptFeedback: request.interrupt_feedback,
    isFeedback,
    coordinatorAction: null,
    plannerShouldInterrupt: false,
    done: "none",
  };

  const stream = await planningGraph.stream(finalPlanningState, {
    streamMode: ["custom", "values"],
    ...(signal ? { signal } : {}),
  });

  for await (const chunk of stream) {
    if (Array.isArray(chunk) && chunk.length === 2) {
      const [mode, payload] = chunk;
      if (mode === "custom") {
        const event = payload as ChatEvent;
        yield event;
      }
      if (mode === "values") {
        finalPlanningState = payload as PlanningGraphState;
      }
    }
  }

  if (finalPlanningState.done === "direct_response") {
    return;
  }

  if (finalPlanningState.plannerShouldInterrupt && finalPlanningState.done === "interrupt_ready") {
    return;
  }

  state = store.get(request.thread_id) ?? state;
  const plan = state.currentPlan
    ? state.currentPlan
    : buildFallbackPlan({
        query: state.researchTopic,
        maxSteps: state.maxStepNum,
        enableWebSearch: state.enableWebSearch,
      });

  if (!state.currentPlan) {
    state = { ...state, currentPlan: plan };
    store.set(state);
  }

  const researcherNode = async (s: PlanningGraphState, config?: LangGraphRunnableConfig) => {
    const researcherId = newMessageId();
    const retrieved = await retrieveResources({
      query: s.researchTopic,
      resources: s.resources,
      limit: Math.max(1, Math.min(10, s.maxSearchResults)),
    });

    const toolCallId = newToolCallId();
    const toolCalls: ToolCall[] = [
      {
        type: "tool_call",
        id: toolCallId,
        name: "retrieve_resources",
        args: { query: s.researchTopic, limit: retrieved.length },
      },
    ];
    const toolCallChunks: ToolCallChunk[] = [
      {
        type: "tool_call_chunk",
        index: 0,
        id: toolCallId,
        name: "retrieve_resources",
        args: JSON.stringify(toolCalls[0]!.args),
      },
    ];

    emit(config, {
      type: "tool_calls",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        tool_calls: toolCalls,
        tool_call_chunks: toolCallChunks,
      },
    });
    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        finish_reason: "tool_calls",
      },
    });

    const retrievalText = retrieved
      .map((r, i) => {
        const desc = r.description ? `\n  ${r.description}` : "";
        const excerpt = r.excerpt
          ? `\n  Content:\n${r.excerpt
              .split("\n")
              .map((line) => `  ${line}`)
              .join("\n")}`
          : "";
        return `- [${i + 1}] ${r.title} (${r.uri})${desc}${excerpt}`;
      })
      .join("\n");

    emit(config, {
      type: "tool_call_result",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "tool",
        tool_call_id: toolCallId,
        content: retrievalText || "(no resources)",
      },
    });

    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        finish_reason: "stop",
      },
    });

    const updates = [
      s.backgroundInvestigationResults ? `Background investigation:\n${s.backgroundInvestigationResults}` : null,
      retrievalText ? `Retrieved resources:\n${retrievalText}` : null,
    ].filter((x): x is string => Boolean(x));

    const next = {
      ...(s as WorkflowState),
      observations: [...s.observations, ...updates],
    };
    store.set(next);

    return { observations: next.observations };
  };

  const reporterNode = async (s: PlanningGraphState, config?: LangGraphRunnableConfig) => {
    const reporterId = newMessageId();
    const sources = s.resources.map((r) => ({ title: r.title, uri: r.uri }));
    const style = s.reportStyle;
    const observations = s.observations;
    const planForReport =
      s.currentPlan ??
      buildFallbackPlan({
        query: s.researchTopic,
        maxSteps: s.maxStepNum,
        enableWebSearch: s.enableWebSearch,
      });

    if (!llm) {
      const fallback = [
        `# ${s.researchTopic || planForReport.title || "Report"}`,
        "",
        `Style: ${style ?? "default"}`,
        "",
        "## Plan",
        planForReport.steps.map((step, i) => `${i + 1}. ${step.title} — ${step.description}`).join("\n"),
        "",
        "## Notes",
        observations.length ? observations.join("\n\n") : "(none)",
        "",
        "## Answer",
        "LLM is not configured. Set BASIC_MODEL__model and BASIC_MODEL__api_key to enable full reporting.",
      ].join("\n");

      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: s.threadId,
          id: reporterId,
          agent: "reporter",
          role: "assistant",
          content: fallback,
        },
      });
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: s.threadId,
          id: reporterId,
          agent: "reporter",
          role: "assistant",
          finish_reason: "stop",
        },
      });
      return {};
    }

    const reportPrompt = buildReporterPrompt({
      query: s.researchTopic,
      locale: s.locale,
      style,
      plan: planForReport,
      observations,
      sources,
    });

    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: reporterId,
        agent: "reporter",
        role: "assistant",
        reasoning_content: "Writing…",
      },
    });

    try {
      for await (const delta of llm.streamChatCompletions({
        messages: [
          { role: "system", content: reportPrompt.system },
          { role: "user", content: reportPrompt.user },
        ],
        ...(config?.signal ? { signal: config.signal } : {}),
      })) {
        if (delta.reasoningContent) {
          emit(config, {
            type: "message_chunk",
            data: {
              thread_id: s.threadId,
              id: reporterId,
              agent: "reporter",
              role: "assistant",
              reasoning_content: delta.reasoningContent,
            },
          });
        }
        if (delta.content) {
          const cleaned = stripThinkTags(delta.content);
          if (!cleaned) continue;
          emit(config, {
            type: "message_chunk",
            data: {
              thread_id: s.threadId,
              id: reporterId,
              agent: "reporter",
              role: "assistant",
              content: cleaned,
            },
          });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      emit(config, {
        type: "message_chunk",
        data: {
          thread_id: s.threadId,
          id: reporterId,
          agent: "reporter",
          role: "assistant",
          content: `\n\n[reporter_error] ${message}`,
        },
      });
    }

    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: reporterId,
        agent: "reporter",
        role: "assistant",
        finish_reason: "stop",
      },
    });

    return {};
  };

  const executionGraph = new StateGraph(PlanningState)
    .addNode("researcher", researcherNode)
    .addNode("reporter", reporterNode)
    .addEdge(START, "researcher")
    .addEdge("researcher", "reporter")
    .addEdge("reporter", END)
    .compile();

  let execState: PlanningGraphState = {
    ...(finalPlanningState as PlanningGraphState),
    ...state,
    incomingText,
    interruptFeedback: request.interrupt_feedback,
    isFeedback,
    done: "none",
  };

  const execStream = await executionGraph.stream(execState, {
    streamMode: ["custom", "values"],
    ...(signal ? { signal } : {}),
  });

  for await (const chunk of execStream) {
    if (Array.isArray(chunk) && chunk.length === 2) {
      const [mode, payload] = chunk;
      if (mode === "custom") {
        const event = payload as ChatEvent;
        yield event;
      }
      if (mode === "values") {
        execState = payload as PlanningGraphState;
      }
    }
  }
  return;
}
