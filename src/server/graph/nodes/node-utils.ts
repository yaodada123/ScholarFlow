import { randomUUID } from "node:crypto";

import type { OpenAIChatMessage, OpenAICompatibleClient, ToolCall as LlmToolCall } from "../../llm/openai-compatible.js";
import { formatMcpToolsForPrompt } from "../../mcp/tools.js";
import type { McpResolvedTool } from "../../mcp/types.js";
import type { SkillId } from "../../schemas.js";
import type { WorkflowState } from "../../runtime/types.js";
import type { TraceRecorder } from "../../trace/recorder.js";
import type { ReportSource } from "../../workflow.js";
import type { ToolCall, ToolCallChunk } from "../types.js";

export function newMessageId(): string {
  return `run-${randomUUID()}`;
}

export function newToolCallId(): string {
  return `call_${randomUUID().replace(/-/g, "")}`;
}

export function stripThinkTags(text: string): string {
  return text.replaceAll("<think>", "").replaceAll("</think>", "");
}

export function hasSkill(state: Pick<WorkflowState, "activeSkills">, skillId: SkillId): boolean {
  return state.activeSkills.includes(skillId);
}

export function academicSearchLimit(state: Pick<WorkflowState, "activeSkills" | "maxSearchResults">): number {
  if (hasSkill(state, "systematic-literature-review")) {
    return Math.min(20, Math.max(10, state.maxSearchResults));
  }
  return state.maxSearchResults;
}

export function openAiToolCallToSse(toolCall: LlmToolCall): ToolCall {
  return {
    type: "tool_call",
    id: toolCall.id,
    name: toolCall.name,
    args: toolCall.args,
  };
}

export function buildToolCallChunks(toolCalls: readonly ToolCall[]): ToolCallChunk[] {
  return toolCalls.map((toolCall, index) => ({
    type: "tool_call_chunk",
    index,
    id: toolCall.id,
    name: toolCall.name,
    args: JSON.stringify(toolCall.args),
  }));
}

export function toolResultContent(title: string, content: string): string {
  return JSON.stringify([{ type: "page", title, url: "", content }]);
}

export function buildMcpResearchPrompt(params: {
  state: WorkflowState;
  retrievedText: string;
  academicText: string;
  skillContext: string;
  mcpTools: readonly McpResolvedTool[];
}): OpenAIChatMessage[] {
  const mcpPrompt = formatMcpToolsForPrompt(params.mcpTools);
  return [
    {
      role: "system",
      content: [
        "You are ScholarFlow Researcher. Decide whether MCP tools are needed to gather additional evidence for the research report.",
        "Call at most the tools that are directly useful. If built-in retrieval and academic search are sufficient, answer with a concise evidence summary and do not call tools.",
        "Do not invent tool names or arguments. Prefer read-only, evidence-gathering calls.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Research topic: ${params.state.researchTopic}`,
        params.skillContext ? `Skill guidance:\n${params.skillContext}` : null,
        params.state.currentPlan ? `Plan:\n${JSON.stringify(params.state.currentPlan, null, 2)}` : null,
        params.state.backgroundInvestigationResults ? `Background investigation:\n${params.state.backgroundInvestigationResults}` : null,
        params.retrievedText ? `Retrieved resources:\n${params.retrievedText}` : null,
        params.academicText ? `Academic literature search:\n${params.academicText}` : null,
        mcpPrompt,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export type CoordinatorDecision =
  | { action: "direct_response"; message: string }
  | { action: "handoff_to_planner" };

export function isChineseLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

export function isLikelyChitChat(userText: string): boolean {
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

export function defaultChitChatReply(params: { locale: string; userText: string }): string {
  if (isChineseLocale(params.locale)) {
    return "你好！我是 ScholarFlow，一个学术研究助手。你可以给我一个研究问题，或上传论文/笔记让我帮你规划研究、整理证据并生成报告。";
  }
  return "Hi! I'm ScholarFlow, an academic research assistant. Share a research question or upload papers/notes, and I can help plan the research, retrieve evidence, and draft a structured report.";
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

export function parseCoordinatorDecision(text: string): CoordinatorDecision | null {
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

function extractObservationSources(observations: string[]): Array<Omit<ReportSource, "id">> {
  const sources: Array<Omit<ReportSource, "id">> = [];
  const seen = new Set<string>();
  const sourcePattern = /^- \[\d+\] (.+?) \(([^)]+)\)(?:\n\s{2,}([^\n]+))?/gm;

  for (const observation of observations) {
    for (const match of observation.matchAll(sourcePattern)) {
      const title = match[1]?.trim();
      const uri = match[2]?.trim();
      const excerpt = match[3]?.trim();
      if (!title || !uri || seen.has(uri)) continue;
      seen.add(uri);
      sources.push({
        title,
        uri,
        kind: uri.startsWith("http") ? "academic" : "resource",
        ...(excerpt ? { excerpt } : {}),
      });
    }
  }

  return sources;
}

export function buildReportSources(params: {
  resources: WorkflowState["resources"];
  observations: string[];
}): ReportSource[] {
  const seen = new Set<string>();
  const sources: ReportSource[] = [];
  const addSource = (source: Omit<ReportSource, "id">) => {
    const uri = source.uri.trim();
    const title = source.title.trim();
    if (!uri || !title || seen.has(uri)) return;
    seen.add(uri);
    sources.push({ ...source, id: `S${sources.length + 1}` });
  };

  for (const resource of params.resources) {
    addSource({ title: resource.title, uri: resource.uri, kind: "resource" });
  }
  for (const source of extractObservationSources(params.observations)) {
    addSource(source);
  }

  return sources;
}

export async function decideCoordinatorAction(params: {
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
    "You are ScholarFlow Coordinator, an academic research assistant. Decide whether to respond directly or hand off to the planner. " +
    "You MUST respond directly for greetings, small talk, identity/capability questions (e.g., 'who are you', 'what can you do'). " +
    "You MUST hand off for academic research, literature review, factual analysis, source-grounded writing, or information requests. " +
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

function summarizeNodeOutput(output: unknown): Record<string, unknown> {
  if (!output || typeof output !== "object") return {};
  const obj = output as Record<string, unknown>;
  return {
    keys: Object.keys(obj),
    ...(Array.isArray(obj.observations) ? { observations: obj.observations.length } : {}),
    ...(obj.done ? { done: obj.done } : {}),
    ...(typeof obj.plannerShouldInterrupt === "boolean" ? { plannerShouldInterrupt: obj.plannerShouldInterrupt } : {}),
  };
}

export async function tracedNode<TResult>(
  trace: TraceRecorder | undefined,
  params: { spanId: string; name: string; agent: string; input?: unknown; setCurrentSpan: (spanId: string | undefined) => void; currentSpan: string | undefined },
  fn: () => Promise<TResult>,
): Promise<TResult> {
  trace?.spanStarted({ spanId: params.spanId, name: params.name, agent: params.agent, input: params.input });
  const previousSpan = params.currentSpan;
  params.setCurrentSpan(params.spanId);
  try {
    const result = await fn();
    trace?.spanEnded({ spanId: params.spanId, name: params.name, agent: params.agent, status: "ok", output: summarizeNodeOutput(result) });
    return result;
  } catch (e) {
    trace?.spanEnded({ spanId: params.spanId, name: params.name, agent: params.agent, status: "error", error: e });
    throw e;
  } finally {
    params.setCurrentSpan(previousSpan);
  }
}
