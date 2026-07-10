import { randomUUID } from "node:crypto";

import { CallbackHandler } from "@langfuse/langchain";
import { Langfuse, type LangfuseTraceClient } from "langfuse";

export type LangfuseConfig = {
  secretKey: string;
  publicKey: string;
  baseUrl: string;
};

export type LangfuseGenerationParams = {
  name: string;
  model: string;
  stream: boolean;
  messages: unknown;
  tools?: unknown;
  toolChoice?: string;
  modelParameters?: Record<string, unknown>;
};

export type LangfuseGenerationResult = {
  output?: unknown;
  finishReason?: string;
  usageDetails?: Record<string, number>;
};

export type LangfuseGenerationTrace = {
  end: (result: LangfuseGenerationResult) => void;
  error: (error: unknown) => void;
};

export type LangfuseRuntime = {
  handler?: CallbackHandler;
  metadata: Record<string, unknown>;
  flush: () => Promise<void>;
  traceGeneration: (params: LangfuseGenerationParams) => LangfuseGenerationTrace | undefined;
};

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  return value.trim() || undefined;
}

export function loadLangfuseConfig(): LangfuseConfig | null {
  const secretKey = readEnv("LANGFUSE_SECRET_KEY");
  const publicKey = readEnv("LANGFUSE_PUBLIC_KEY");
  const baseUrl = readEnv("LANGFUSE_BASE_URL") ?? "http://localhost:3090";

  if (!secretKey || !publicKey) return null;

  return { secretKey, publicKey, baseUrl };
}

export function isLangfuseEnabled(): boolean {
  return loadLangfuseConfig() !== null;
}

export function createLangfuseRuntime(params: {
  runId: string;
  threadId: string;
  workflowMode?: string;
  userId?: string;
  tags?: string[];
}): LangfuseRuntime {
  const metadata: Record<string, unknown> = {
    trace_id: params.runId,
    run_id: params.runId,
    thread_id: params.threadId,
    ...(params.workflowMode ? { workflow_mode: params.workflowMode } : {}),
  };

  const disabled: LangfuseRuntime = {
    metadata,
    flush: async () => {},
    traceGeneration: () => undefined,
  };

  const config = loadLangfuseConfig();
  if (!config) return disabled;

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

function traceLangfuseGeneration(
  trace: LangfuseTraceClient,
  params: LangfuseGenerationParams,
): LangfuseGenerationTrace {
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

function sanitizeRecord(input: Record<string, unknown> | undefined): Record<string, string | number | boolean> | undefined {
  if (!input) return undefined;
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
    }
  }
  return Object.keys(output).length ? output : undefined;
}
