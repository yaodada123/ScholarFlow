import { randomUUID } from "node:crypto";
import { CallbackHandler } from "@langfuse/langchain";
import { Langfuse } from "langfuse";
function readEnv(key) {
    const value = process.env[key];
    if (!value)
        return undefined;
    return value.trim() || undefined;
}
export function loadLangfuseConfig() {
    const secretKey = readEnv("LANGFUSE_SECRET_KEY");
    const publicKey = readEnv("LANGFUSE_PUBLIC_KEY");
    const baseUrl = readEnv("LANGFUSE_BASE_URL") ?? "http://localhost:3090";
    if (!secretKey || !publicKey)
        return null;
    return { secretKey, publicKey, baseUrl };
}
export function isLangfuseEnabled() {
    return loadLangfuseConfig() !== null;
}
export function createLangfuseRuntime(params) {
    const metadata = {
        trace_id: params.runId,
        run_id: params.runId,
        thread_id: params.threadId,
        ...(params.workflowMode ? { workflow_mode: params.workflowMode } : {}),
    };
    const disabled = {
        metadata,
        flush: async () => { },
        traceGeneration: () => undefined,
    };
    const config = loadLangfuseConfig();
    if (!config)
        return disabled;
    process.env.LANGFUSE_SECRET_KEY = config.secretKey;
    process.env.LANGFUSE_PUBLIC_KEY = config.publicKey;
    process.env.LANGFUSE_BASE_URL = config.baseUrl;
    process.env.LANGFUSE_BASEURL = config.baseUrl;
    const client = new Langfuse({
        secretKey: config.secretKey,
        publicKey: config.publicKey,
        baseUrl: config.baseUrl,
    });
    const trace = client.trace({
        id: params.runId,
        name: "chat.workflow",
        sessionId: params.threadId,
        ...(params.userId ? { userId: params.userId } : {}),
        ...(params.tags?.length ? { tags: params.tags } : {}),
        metadata,
    });
    return {
        handler: new CallbackHandler({
            ...(params.userId ? { userId: params.userId } : {}),
            sessionId: params.threadId,
            ...(params.tags?.length ? { tags: params.tags } : {}),
            traceMetadata: metadata,
        }),
        metadata,
        flush: async () => {
            await client.flushAsync();
        },
        traceGeneration: (generationParams) => traceLangfuseGeneration(trace, generationParams),
    };
}
function traceLangfuseGeneration(trace, params) {
    const startedAt = new Date();
    const modelParameters = sanitizeRecord(params.modelParameters);
    const generation = trace.generation({
        id: randomUUID(),
        name: params.name,
        startTime: startedAt,
        model: params.model,
        ...(modelParameters ? { modelParameters } : {}),
        input: {
            messages: params.messages,
            ...(params.tools ? { tools: params.tools } : {}),
        },
        metadata: {
            stream: params.stream,
            ...(params.toolChoice ? { tool_choice: params.toolChoice } : {}),
        },
    });
    return {
        end: (result) => {
            generation.end({
                output: result.output,
                metadata: {
                    stream: params.stream,
                    latency_ms: Date.now() - startedAt.getTime(),
                    ...(result.finishReason ? { finish_reason: result.finishReason } : {}),
                },
                ...(result.usageDetails ? { usageDetails: result.usageDetails } : {}),
            });
        },
        error: (error) => {
            generation.end({
                level: "ERROR",
                statusMessage: error instanceof Error ? error.message : String(error),
                metadata: {
                    stream: params.stream,
                    latency_ms: Date.now() - startedAt.getTime(),
                },
            });
        },
    };
}
function sanitizeRecord(input) {
    if (!input)
        return undefined;
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            output[key] = value;
        }
    }
    return Object.keys(output).length ? output : undefined;
}
