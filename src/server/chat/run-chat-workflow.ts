import { randomUUID } from "node:crypto";

import type { ChatRequest, SkillId } from "../schemas.js";
import type { LlmConfig } from "../llm/env-models.js";
import { loadLlmConfig } from "../llm/env-models.js";
import { OpenAICompatibleClient, type OpenAIChatMessage } from "../llm/openai-compatible.js";
import { knowledgeSourceToResource, listKnowledgeSources } from "../knowledge/store.js";
import { selectSkills } from "../skills/selector.js";
import { buildFallbackPlan } from "../workflow.js";
import type { ThreadStore } from "../runtime/thread-store.js";
import type { WorkflowState } from "../runtime/types.js";
import type { TraceRecorder } from "../trace/recorder.js";
import type { TraceStatus } from "../trace/types.js";
import { createLangfuseRuntime } from "../trace/langfuse.js";
import { buildExecutionGraph, buildPlanningGraph } from "../graph/build-research-graph.js";
import { createExecutionNodes, createPlanningNodes } from "../graph/nodes/research-nodes.js";
import { streamResearchGraphEvents } from "../graph/stream-adapter.js";
import type { ResearchGraphState } from "../graph/state.js";
import type { ChatEvent } from "../graph/types.js";

function newMessageId(): string {
  return `run-${randomUUID()}`;
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

function normalizeChatMessageContent(content: ChatRequest["messages"][number]["content"]): string {
  if (typeof content === "string") return content;
  return content.map((c) => c.text ?? "").join("");
}

function normalizeChatMessages(request: ChatRequest): OpenAIChatMessage[] {
  return request.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: normalizeChatMessageContent(m.content),
    }))
    .filter((m) => m.content.trim().length > 0);
}

function plainChatFallback(locale: string): string {
  if (isChineseLocale(locale)) {
    return "我可以进行普通对话，但当前未配置模型。请配置 BASIC_MODEL__MODEL 和 BASIC_MODEL__API_KEY 后再试。";
  }
  return "I can chat normally, but no model is configured. Please set BASIC_MODEL__MODEL and BASIC_MODEL__API_KEY, then try again.";
}

function plainChatSystemPrompt(locale: string): string {
  return [
    "You are ScholarFlow in normal chat mode.",
    "Answer the user's message conversationally and helpfully.",
    "Do not create a research plan, do not run academic research workflow, and do not promise evidence retrieval or a full research report.",
    "If the user asks for a research report, literature review, source-grounded investigation, or evidence retrieval, explain that they can enable Research Mode to run the full workflow, while still providing a concise direct answer if possible.",
    `Respond in the user's language. Locale: ${locale}.`,
  ].join(" ");
}

function isChineseLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

function contentPreview(content: unknown): Record<string, unknown> {
  if (typeof content !== "string") return {};
  return {
    content_length: content.length,
    content_preview: content.slice(0, 300),
  };
}

function resolveActiveSkills(params: {
  request: ChatRequest;
  query: string;
  existing: WorkflowState | undefined;
  isFeedback: boolean;
}): { activeSkills: SkillId[]; reason: string } {
  const { request, query, existing, isFeedback } = params;
  if (!request.enable_skills) return { activeSkills: [], reason: "skills disabled" };
  if (request.selected_skills.length) return { activeSkills: request.selected_skills, reason: "manual selection" };
  if (isFeedback && existing) {
    return {
      activeSkills: existing.activeSkills,
      reason: existing.skillSelectionReason ?? "preserved from pending plan",
    };
  }
  const selected = selectSkills({ query, resources: request.resources });
  return {
    activeSkills: selected.activeSkills.map((skill) => skill.id),
    reason: selected.reason,
  };
}

async function resolveRequestResources(request: ChatRequest): Promise<ChatRequest["resources"]> {
  const resources = [...request.resources];
  if (!request.project_id) return resources;

  try {
    const projectSources = await listKnowledgeSources(request.project_id);
    const seen = new Set(resources.map((resource) => resource.uri));
    for (const source of projectSources) {
      const resource = knowledgeSourceToResource(source);
      if (seen.has(resource.uri)) continue;
      seen.add(resource.uri);
      resources.push(resource);
    }
  } catch (error) {
    console.warn(`[knowledge] Failed to load project sources for ${request.project_id}`, error);
  }

  return resources;
}

function makeBaseState(params: {
  request: ChatRequest;
  threadId: string;
  query: string;
  activeSkills: SkillId[];
  skillSelectionReason: string;
}): WorkflowState {
  const { request, threadId, query, activeSkills, skillSelectionReason } = params;
  return {
    threadId,
    ...(request.project_id ? { projectId: request.project_id } : {}),
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
    enableClarification: request.enable_clarification ?? false,
    maxClarificationRounds: request.max_clarification_rounds ?? 3,
    clarificationRounds: 0,
    clarificationContext: [],
    reportStyle: request.report_style,
    activeSkills,
    skillSelectionReason,
  };
}

async function* runPlainChatResponse(params: {
  request: ChatRequest;
  llm: OpenAICompatibleClient | null;
  incomingText: string;
  signal?: AbortSignal;
  trace?: TraceRecorder;
}): AsyncIterable<ChatEvent> {
  const { request, llm, incomingText, signal, trace } = params;
  const spanId = `span_plain_chat_${randomUUID()}`;
  const id = newMessageId();

  const emit = (data: Record<string, unknown>): ChatEvent => {
    trace?.message({
      spanId,
      agent: "coordinator",
      metadata: {
        id: data.id,
        role: data.role,
        finish_reason: data.finish_reason,
        ...contentPreview(data.content),
      },
    });
    return { type: "message_chunk", data };
  };

  trace?.spanStarted({
    spanId,
    name: "chat.plain_response",
    agent: "coordinator",
    input: { resources: request.resources.length },
  });

  try {
    if (!llm) {
      yield emit({
        thread_id: request.thread_id,
        id,
        agent: "coordinator",
        role: "assistant",
        content: plainChatFallback(request.locale),
      });
      yield emit({
        thread_id: request.thread_id,
        id,
        agent: "coordinator",
        role: "assistant",
        finish_reason: "stop",
      });
      trace?.spanEnded({ spanId, name: "chat.plain_response", agent: "coordinator", status: "ok" });
      return;
    }

    const chatMessages = normalizeChatMessages(request);
    if (chatMessages.length === 0 && incomingText.trim()) {
      chatMessages.push({ role: "user", content: incomingText });
    }

    const resourceNotice: OpenAIChatMessage[] = request.resources.length
      ? [
          {
            role: "system",
            content:
              "The user attached resources, but normal chat mode does not retrieve or inspect resource contents. If the request depends on those materials, ask the user to enable Research Mode.",
          },
        ]
      : [];

    for await (const delta of llm.streamChatCompletions({
      messages: [
        { role: "system", content: plainChatSystemPrompt(request.locale) },
        ...resourceNotice,
        ...chatMessages,
      ],
      ...(signal ? { signal } : {}),
    })) {
      if (delta.content) {
        const cleaned = stripThinkTags(delta.content);
        if (cleaned) {
          yield emit({
            thread_id: request.thread_id,
            id,
            agent: "coordinator",
            role: "assistant",
            content: cleaned,
          });
        }
      }
      if (delta.finishReason) break;
    }

    yield emit({
      thread_id: request.thread_id,
      id,
      agent: "coordinator",
      role: "assistant",
      finish_reason: "stop",
    });
    trace?.spanEnded({ spanId, name: "chat.plain_response", agent: "coordinator", status: "ok" });
  } catch (e) {
    trace?.spanEnded({ spanId, name: "chat.plain_response", agent: "coordinator", status: "error", error: e });
    throw e;
  }
}

function upsertThreadState(params: {
  store: ThreadStore;
  request: ChatRequest;
  query: string;
  isFeedback: boolean;
  activeSkills: SkillId[];
  skillSelectionReason: string;
}): WorkflowState {
  const threadId = params.request.thread_id;
  const existing = params.store.get(threadId);
  if (!existing) {
    const created = makeBaseState({
      request: params.request,
      threadId,
      query: params.query,
      activeSkills: params.activeSkills,
      skillSelectionReason: params.skillSelectionReason,
    });
    params.store.set(created);
    return created;
  }

  const merged: WorkflowState = {
    ...existing,
    ...(params.request.project_id ? { projectId: params.request.project_id } : {}),
    locale: params.request.locale,
    enableBackgroundInvestigation: params.request.enable_background_investigation,
    enableWebSearch: params.request.enable_web_search,
    maxPlanIterations: params.request.max_plan_iterations,
    maxStepNum: params.request.max_step_num,
    maxSearchResults: params.request.max_search_results,
    autoAcceptedPlan: params.request.auto_accepted_plan,
    reportStyle: params.request.report_style,
    activeSkills: params.activeSkills,
    skillSelectionReason: params.skillSelectionReason,
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

export async function* runChatWorkflow(params: {
  request: ChatRequest;
  store: ThreadStore;
  signal?: AbortSignal;
  trace?: TraceRecorder;
}): AsyncIterable<ChatEvent> {
  const { request, store, signal, trace } = params;
  const incomingText = normalizeUserContent(request);
  let currentSpanId: string | undefined;
  let runStatus: TraceStatus = "ok";
  let runEndReason = "completed";

  const isFeedback = request.interrupt_feedback === "accepted" || request.interrupt_feedback === "edit_plan";
  const existing = store.get(request.thread_id);
  const query = isFeedback ? (existing?.researchTopic ?? incomingText) : incomingText;
  const resolvedResources = await resolveRequestResources(request);
  const requestWithKnowledge: ChatRequest = { ...request, resources: resolvedResources };
  const skillSelection = resolveActiveSkills({ request: requestWithKnowledge, query, existing, isFeedback });

  trace?.runStarted({
    query: incomingText,
    resources: resolvedResources.length,
    project_id: request.project_id,
    enable_web_search: request.enable_web_search,
    enable_background_investigation: request.enable_background_investigation,
    interrupt_feedback: request.interrupt_feedback,
    workflow_mode: request.workflow_mode,
    active_skills: skillSelection.activeSkills,
    skill_selection_reason: skillSelection.reason,
  });

  let state = upsertThreadState({
    store,
    request: requestWithKnowledge,
    query,
    isFeedback,
    activeSkills: skillSelection.activeSkills,
    skillSelectionReason: skillSelection.reason,
  });

  const langfuse = createLangfuseRuntime({
    runId: trace?.runId ?? `run_${randomUUID()}`,
    threadId: request.thread_id,
    ...(request.workflow_mode ? { workflowMode: request.workflow_mode, tags: [request.workflow_mode] } : {}),
  });
  const llmCfg = pickLlmConfig({ enableDeepThinking: request.enable_deep_thinking });
  const llm = llmCfg ? new OpenAICompatibleClient(llmCfg, { langfuse }) : null;

  try {
  if (request.workflow_mode === "chat" && !isFeedback) {
    for await (const event of runPlainChatResponse({
      request: requestWithKnowledge,
      llm,
      incomingText,
      ...(signal ? { signal } : {}),
      ...(trace ? { trace } : {}),
    })) {
      yield event;
    }
    runEndReason = "plain_chat";
    return;
  }

  const planningNodes = createPlanningNodes({
    llm,
    store,
    ...(trace ? { trace } : {}),
    request: requestWithKnowledge,
    getCurrentSpan: () => currentSpanId,
    setCurrentSpan: (spanId) => {
      currentSpanId = spanId;
    },
  });

  const planningGraph = buildPlanningGraph(planningNodes);

  let finalPlanningState: ResearchGraphState = {
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
    ...(langfuse.handler ? { callbacks: [langfuse.handler] } : {}),
  });
  for await (const event of streamResearchGraphEvents<ResearchGraphState>({
    stream,
    onState: (nextState) => {
      finalPlanningState = nextState;
    },
  })) {
    yield event;
  }

  if (finalPlanningState.done === "direct_response") {
    runEndReason = "direct_response";
    return;
  }

  if (finalPlanningState.plannerShouldInterrupt && finalPlanningState.done === "interrupt_ready") {
    runEndReason = "interrupt_ready";
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

  const executionNodes = createExecutionNodes({
    llm,
    store,
    ...(trace ? { trace } : {}),
    request: requestWithKnowledge,
    getCurrentSpan: () => currentSpanId,
    setCurrentSpan: (spanId) => {
      currentSpanId = spanId;
    },
  });

  const executionGraph = buildExecutionGraph(executionNodes);

  let execState: ResearchGraphState = {
    ...finalPlanningState,
    ...state,
    incomingText,
    interruptFeedback: request.interrupt_feedback,
    isFeedback,
    done: "none",
  };

  const execStream = await executionGraph.stream(execState, {
    streamMode: ["custom", "values"],
    ...(signal ? { signal } : {}),
    ...(langfuse.handler ? { callbacks: [langfuse.handler] } : {}),
  });
  for await (const event of streamResearchGraphEvents<ResearchGraphState>({
    stream: execStream,
    onState: (nextState) => {
      execState = nextState;
    },
  })) {
    yield event;
  }
  return;
  } catch (e) {
    runStatus = signal?.aborted ? "aborted" : "error";
    trace?.error(e, currentSpanId ? { spanId: currentSpanId } : {});
    throw e;
  } finally {
    if (signal?.aborted) runStatus = "aborted";
    trace?.runEnded(runStatus, { reason: runEndReason });
    await trace?.flush();
    await langfuse.flush();
  }
}
