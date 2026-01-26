import type { LlmConfig } from "./env-models.js";

export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
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

export class OpenAICompatibleClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly temperature: number | undefined;
  private readonly maxTokens: number | undefined;
  private readonly timeoutMs: number;

  constructor(cfg: LlmConfig) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = cfg.model;
    this.temperature = cfg.temperature;
    this.maxTokens = cfg.maxTokens;
    this.timeoutMs = cfg.timeoutMs ?? 60000;
  }

  async *streamChatCompletions(params: {
    messages: OpenAIChatMessage[];
    signal?: AbortSignal;
  }): AsyncIterable<StreamDelta> {
    const controller = new AbortController();
    const signal = params.signal
      ? AbortSignal.any([params.signal, controller.signal])
      : controller.signal;

    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const body: Record<string, unknown> = {
        model: this.model,
        messages: params.messages,
        stream: true,
      };
      if (this.temperature != null) body.temperature = this.temperature;
      if (this.maxTokens != null) body.max_tokens = this.maxTokens;

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
          if (data === "[DONE]") return;

          let parsed: unknown;
          try {
            parsed = JSON.parse(data) as unknown;
          } catch {
            continue;
          }

          const delta = extractDelta(parsed);
          if (delta) yield delta;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }
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
