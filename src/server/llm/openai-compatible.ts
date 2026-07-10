import type { LlmConfig } from "./env-models.js";
import type { LangfuseGenerationTrace, LangfuseRuntime } from "../trace/langfuse.js";

export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
};

export type OpenAIChatTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type StreamDelta = {
  content?: string;
  reasoningContent?: string;
  toolCalls?: ToolCall[];
  finishReason?: "stop" | "tool_calls" | "length" | string;
};

export type OpenAICompatibleClientOptions = {
  langfuse?: LangfuseRuntime;
};

export class OpenAICompatibleClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly temperature: number | undefined;
  private readonly maxTokens: number | undefined;
  private readonly timeoutMs: number;
  private readonly langfuse: LangfuseRuntime | undefined;

  constructor(cfg: LlmConfig, options: OpenAICompatibleClientOptions = {}) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = cfg.model;
    this.temperature = cfg.temperature;
    this.maxTokens = cfg.maxTokens;
    this.timeoutMs = cfg.timeoutMs ?? 60000;
    this.langfuse = options.langfuse;
  }

  async *streamChatCompletions(params: {
    messages: OpenAIChatMessage[];
    tools?: OpenAIChatTool[];
    toolChoice?: "auto" | "none";
    signal?: AbortSignal;
  }): AsyncIterable<StreamDelta> {
    const controller = new AbortController();
    const signal = params.signal
      ? AbortSignal.any([params.signal, controller.signal])
      : controller.signal;

    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let generation: LangfuseGenerationTrace | undefined;
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const body: Record<string, unknown> = {
        model: this.model,
        messages: params.messages,
        stream: true,
      };
      if (this.temperature != null) body.temperature = this.temperature;
      if (this.maxTokens != null) body.max_tokens = this.maxTokens;
      if (params.tools?.length) {
        body.tools = params.tools;
        body.tool_choice = params.toolChoice ?? "auto";
      }

      generation = this.startGenerationTrace({
        name: "llm.chat.stream",
        stream: true,
        messages: params.messages,
        ...(params.tools?.length ? { tools: params.tools, toolChoice: params.toolChoice ?? "auto" } : {}),
      });
      let content = "";
      let reasoningContent = "";
      let finishReason: string | undefined;
      const toolCalls: ToolCall[] = [];

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`LLM HTTP ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`);
      }

      const decoder = new TextDecoder();
      let buffer = "";

      let done = false;
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        while (true) {
          const idx = buffer.indexOf("\n");
          if (idx < 0) break;
          const line = buffer.slice(0, idx).trimEnd();
          buffer = buffer.slice(idx + 1);

          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice("data:".length).trim();
          if (!data) continue;
          if (data === "[DONE]") {
            done = true;
            break;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(data) as unknown;
          } catch {
            continue;
          }

          const delta = extractDelta(parsed);
          if (delta) {
            content += delta.content ?? "";
            reasoningContent += delta.reasoningContent ?? "";
            if (delta.finishReason) finishReason = delta.finishReason;
            if (delta.toolCalls?.length) toolCalls.push(...delta.toolCalls);
            yield delta;
          }
        }
        if (done) break;
      }
      generation?.end({
        output: summarizeCompletionOutput({ content, reasoningContent, toolCalls }),
        ...(finishReason ? { finishReason } : {}),
      });
    } catch (error) {
      generation?.error(error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createChatCompletion(params: {
    messages: OpenAIChatMessage[];
    tools?: OpenAIChatTool[];
    toolChoice?: "auto" | "none";
    signal?: AbortSignal;
  }): Promise<StreamDelta> {
    const controller = new AbortController();
    const signal = params.signal
      ? AbortSignal.any([params.signal, controller.signal])
      : controller.signal;

    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let generation: LangfuseGenerationTrace | undefined;
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const body: Record<string, unknown> = {
        model: this.model,
        messages: params.messages,
        stream: false,
      };
      if (this.temperature != null) body.temperature = this.temperature;
      if (this.maxTokens != null) body.max_tokens = this.maxTokens;
      if (params.tools?.length) {
        body.tools = params.tools;
        body.tool_choice = params.toolChoice ?? "auto";
      }

      generation = this.startGenerationTrace({
        name: "llm.chat.completion",
        stream: false,
        messages: params.messages,
        ...(params.tools?.length ? { tools: params.tools, toolChoice: params.toolChoice ?? "auto" } : {}),
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LLM HTTP ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`);
      }

      const payload = (await res.json().catch(() => null)) as unknown;
      const message = extractMessage(payload) ?? {};
      const usageDetails = extractUsageDetails(payload);
      generation?.end({
        output: summarizeCompletionOutput({
          content: message.content ?? "",
          reasoningContent: message.reasoningContent ?? "",
          toolCalls: message.toolCalls ?? [],
        }),
        ...(message.finishReason ? { finishReason: message.finishReason } : {}),
        ...(usageDetails ? { usageDetails } : {}),
      });
      return message;
    } catch (error) {
      generation?.error(error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private startGenerationTrace(params: {
    name: string;
    stream: boolean;
    messages: OpenAIChatMessage[];
    tools?: OpenAIChatTool[];
    toolChoice?: string;
  }): LangfuseGenerationTrace | undefined {
    return this.langfuse?.traceGeneration({
      name: params.name,
      model: this.model,
      stream: params.stream,
      messages: summarizeMessages(params.messages),
      ...(params.tools?.length ? { tools: summarizeTools(params.tools) } : {}),
      ...(params.toolChoice ? { toolChoice: params.toolChoice } : {}),
      modelParameters: {
        ...(this.temperature != null ? { temperature: this.temperature } : {}),
        ...(this.maxTokens != null ? { max_tokens: this.maxTokens } : {}),
      },
    });
  }
}

function extractMessage(payload: unknown): StreamDelta | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const choices = p.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const choice = choices[0] as Record<string, unknown>;
  const finishReasonRaw = choice.finish_reason;
  const finishReason = typeof finishReasonRaw === "string" ? finishReasonRaw : undefined;
  const message = choice.message;
  if (!message || typeof message !== "object") return finishReason ? { finishReason } : null;
  const m = message as Record<string, unknown>;
  const content = typeof m.content === "string" ? m.content : undefined;
  const reasoningContent = typeof m.reasoning_content === "string" ? m.reasoning_content : undefined;
  const toolCalls = parseToolCalls(m.tool_calls);
  return {
    ...(content ? { content } : {}),
    ...(reasoningContent ? { reasoningContent } : {}),
    ...(toolCalls ? { toolCalls } : {}),
    ...(finishReason ? { finishReason } : {}),
  };
}

function extractDelta(payload: unknown): StreamDelta | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const choices = p.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const choice = choices[0] as Record<string, unknown>;
  const finishReasonRaw = choice.finish_reason;
  const finishReason = typeof finishReasonRaw === "string" ? finishReasonRaw : undefined;

  const delta = choice.delta;
  if (!delta || typeof delta !== "object") {
    return finishReason ? { finishReason } : null;
  }

  const d = delta as Record<string, unknown>;

  const content = typeof d.content === "string" ? d.content : undefined;
  const reasoningContent =
    typeof (d as Record<string, unknown>).reasoning_content === "string"
      ? ((d as Record<string, unknown>).reasoning_content as string)
      : typeof (d as Record<string, unknown>).reasoning === "string"
        ? ((d as Record<string, unknown>).reasoning as string)
        : undefined;

  const toolCalls = parseToolCalls(d.tool_calls);

  if (!content && !reasoningContent && !toolCalls && !finishReason) return null;
  return {
    ...(content ? { content } : {}),
    ...(reasoningContent ? { reasoningContent } : {}),
    ...(toolCalls ? { toolCalls } : {}),
    ...(finishReason ? { finishReason } : {}),
  };
}

function parseToolCalls(raw: unknown): ToolCall[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: ToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const id = typeof it.id === "string" ? it.id : undefined;
    const fn = it.function;
    if (!fn || typeof fn !== "object") continue;
    const f = fn as Record<string, unknown>;
    const name = typeof f.name === "string" ? f.name : undefined;
    const argsText = typeof f.arguments === "string" ? f.arguments : "{}";
    if (!id || !name) continue;
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(argsText) as unknown;
      if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
    } catch {
      args = {};
    }
    out.push({ id, name, args });
  }
  return out.length ? out : undefined;
}

function summarizeMessages(messages: readonly OpenAIChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    role: message.role,
    ...(message.name ? { name: message.name } : {}),
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    ...summarizeContent(message.content),
    ...(message.tool_calls?.length
      ? { tool_calls: message.tool_calls.map((toolCall) => ({ id: toolCall.id, name: toolCall.function.name })) }
      : {}),
  }));
}

function summarizeTools(tools: readonly OpenAIChatTool[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    name: tool.function.name,
    ...(tool.function.description ? { description: tool.function.description.slice(0, 300) } : {}),
  }));
}

function summarizeContent(content: string | null): Record<string, unknown> {
  if (content == null) return { content: null };
  return {
    content_length: content.length,
    content_preview: content.slice(0, 1000),
  };
}

function summarizeCompletionOutput(params: {
  content: string;
  reasoningContent: string;
  toolCalls: readonly ToolCall[];
}): Record<string, unknown> {
  return {
    content_length: params.content.length,
    content_preview: params.content.slice(0, 1000),
    ...(params.reasoningContent ? { reasoning_content_length: params.reasoningContent.length } : {}),
    ...(params.toolCalls.length ? { tool_calls: params.toolCalls.map((toolCall) => ({ id: toolCall.id, name: toolCall.name })) } : {}),
  };
}

function extractUsageDetails(payload: unknown): Record<string, number> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const raw = usage as Record<string, unknown>;
  const details: Record<string, number> = {};
  for (const [sourceKey, targetKey] of [
    ["prompt_tokens", "input"],
    ["completion_tokens", "output"],
    ["total_tokens", "total"],
  ] as const) {
    const value = raw[sourceKey];
    if (typeof value === "number" && Number.isFinite(value)) details[targetKey] = value;
  }
  return Object.keys(details).length ? details : undefined;
}
