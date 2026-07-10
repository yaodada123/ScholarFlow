export class OpenAICompatibleClient {
    apiKey;
    baseUrl;
    model;
    temperature;
    maxTokens;
    timeoutMs;
    langfuse;
    constructor(cfg, options = {}) {
        this.apiKey = cfg.apiKey;
        this.baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
        this.model = cfg.model;
        this.temperature = cfg.temperature;
        this.maxTokens = cfg.maxTokens;
        this.timeoutMs = cfg.timeoutMs ?? 60000;
        this.langfuse = options.langfuse;
    }
    async *streamChatCompletions(params) {
        const controller = new AbortController();
        const signal = params.signal
            ? AbortSignal.any([params.signal, controller.signal])
            : controller.signal;
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        let generation;
        try {
            const url = `${this.baseUrl}/chat/completions`;
            const body = {
                model: this.model,
                messages: params.messages,
                stream: true,
            };
            if (this.temperature != null)
                body.temperature = this.temperature;
            if (this.maxTokens != null)
                body.max_tokens = this.maxTokens;
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
            let finishReason;
            const toolCalls = [];
            const headers = {
                "Content-Type": "application/json",
            };
            if (this.apiKey)
                headers.Authorization = `Bearer ${this.apiKey}`;
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
            for await (const chunk of res.body) {
                buffer += decoder.decode(chunk, { stream: true });
                while (true) {
                    const idx = buffer.indexOf("\n");
                    if (idx < 0)
                        break;
                    const line = buffer.slice(0, idx).trimEnd();
                    buffer = buffer.slice(idx + 1);
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:"))
                        continue;
                    const data = trimmed.slice("data:".length).trim();
                    if (!data)
                        continue;
                    if (data === "[DONE]") {
                        done = true;
                        break;
                    }
                    let parsed;
                    try {
                        parsed = JSON.parse(data);
                    }
                    catch {
                        continue;
                    }
                    const delta = extractDelta(parsed);
                    if (delta) {
                        content += delta.content ?? "";
                        reasoningContent += delta.reasoningContent ?? "";
                        if (delta.finishReason)
                            finishReason = delta.finishReason;
                        if (delta.toolCalls?.length)
                            toolCalls.push(...delta.toolCalls);
                        yield delta;
                    }
                }
                if (done)
                    break;
            }
            generation?.end({
                output: summarizeCompletionOutput({ content, reasoningContent, toolCalls }),
                ...(finishReason ? { finishReason } : {}),
            });
        }
        catch (error) {
            generation?.error(error);
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async createChatCompletion(params) {
        const controller = new AbortController();
        const signal = params.signal
            ? AbortSignal.any([params.signal, controller.signal])
            : controller.signal;
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        let generation;
        try {
            const url = `${this.baseUrl}/chat/completions`;
            const body = {
                model: this.model,
                messages: params.messages,
                stream: false,
            };
            if (this.temperature != null)
                body.temperature = this.temperature;
            if (this.maxTokens != null)
                body.max_tokens = this.maxTokens;
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
            const headers = {
                "Content-Type": "application/json",
            };
            if (this.apiKey)
                headers.Authorization = `Bearer ${this.apiKey}`;
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
            const payload = (await res.json().catch(() => null));
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
        }
        catch (error) {
            generation?.error(error);
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    startGenerationTrace(params) {
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
function extractMessage(payload) {
    if (!payload || typeof payload !== "object")
        return null;
    const p = payload;
    const choices = p.choices;
    if (!Array.isArray(choices) || choices.length === 0)
        return null;
    const choice = choices[0];
    const finishReasonRaw = choice.finish_reason;
    const finishReason = typeof finishReasonRaw === "string" ? finishReasonRaw : undefined;
    const message = choice.message;
    if (!message || typeof message !== "object")
        return finishReason ? { finishReason } : null;
    const m = message;
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
function extractDelta(payload) {
    if (!payload || typeof payload !== "object")
        return null;
    const p = payload;
    const choices = p.choices;
    if (!Array.isArray(choices) || choices.length === 0)
        return null;
    const choice = choices[0];
    const finishReasonRaw = choice.finish_reason;
    const finishReason = typeof finishReasonRaw === "string" ? finishReasonRaw : undefined;
    const delta = choice.delta;
    if (!delta || typeof delta !== "object") {
        return finishReason ? { finishReason } : null;
    }
    const d = delta;
    const content = typeof d.content === "string" ? d.content : undefined;
    const reasoningContent = typeof d.reasoning_content === "string"
        ? d.reasoning_content
        : typeof d.reasoning === "string"
            ? d.reasoning
            : undefined;
    const toolCalls = parseToolCalls(d.tool_calls);
    if (!content && !reasoningContent && !toolCalls && !finishReason)
        return null;
    return {
        ...(content ? { content } : {}),
        ...(reasoningContent ? { reasoningContent } : {}),
        ...(toolCalls ? { toolCalls } : {}),
        ...(finishReason ? { finishReason } : {}),
    };
}
function parseToolCalls(raw) {
    if (!Array.isArray(raw) || raw.length === 0)
        return undefined;
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== "object")
            continue;
        const it = item;
        const id = typeof it.id === "string" ? it.id : undefined;
        const fn = it.function;
        if (!fn || typeof fn !== "object")
            continue;
        const f = fn;
        const name = typeof f.name === "string" ? f.name : undefined;
        const argsText = typeof f.arguments === "string" ? f.arguments : "{}";
        if (!id || !name)
            continue;
        let args = {};
        try {
            const parsed = JSON.parse(argsText);
            if (parsed && typeof parsed === "object")
                args = parsed;
        }
        catch {
            args = {};
        }
        out.push({ id, name, args });
    }
    return out.length ? out : undefined;
}
function summarizeMessages(messages) {
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
function summarizeTools(tools) {
    return tools.map((tool) => ({
        name: tool.function.name,
        ...(tool.function.description ? { description: tool.function.description.slice(0, 300) } : {}),
    }));
}
function summarizeContent(content) {
    if (content == null)
        return { content: null };
    return {
        content_length: content.length,
        content_preview: content.slice(0, 1000),
    };
}
function summarizeCompletionOutput(params) {
    return {
        content_length: params.content.length,
        content_preview: params.content.slice(0, 1000),
        ...(params.reasoningContent ? { reasoning_content_length: params.reasoningContent.length } : {}),
        ...(params.toolCalls.length ? { tool_calls: params.toolCalls.map((toolCall) => ({ id: toolCall.id, name: toolCall.name })) } : {}),
    };
}
function extractUsageDetails(payload) {
    if (!payload || typeof payload !== "object")
        return undefined;
    const usage = payload.usage;
    if (!usage || typeof usage !== "object")
        return undefined;
    const raw = usage;
    const details = {};
    for (const [sourceKey, targetKey] of [
        ["prompt_tokens", "input"],
        ["completion_tokens", "output"],
        ["total_tokens", "total"],
    ]) {
        const value = raw[sourceKey];
        if (typeof value === "number" && Number.isFinite(value))
            details[targetKey] = value;
    }
    return Object.keys(details).length ? details : undefined;
}
