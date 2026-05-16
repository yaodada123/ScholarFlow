import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { TraceEvent, TraceRunSummary, TraceStatus } from "./types.js";

const traceRoot = path.resolve(process.cwd(), "data", "traces");

function sanitizePathSegment(value: string): string {
  const cleaned = value.replaceAll("\0", "").replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return cleaned || "default";
}

function errorToString(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nowIso(): string {
  return new Date().toISOString();
}

function countJsonlEvents(content: string): number {
  return content.split("\n").filter((line) => line.trim()).length;
}

export class TraceRecorder {
  readonly traceId: string;
  readonly runId: string;
  readonly threadId: string;

  private readonly filePath: string;
  private readonly spanStarts = new Map<string, number>();
  private readonly toolStarts = new Map<string, number>();
  private writeChain: Promise<void>;

  private constructor(params: { threadId: string; runId: string }) {
    this.threadId = params.threadId;
    this.runId = params.runId;
    this.traceId = params.runId;

    const safeThreadId = sanitizePathSegment(params.threadId);
    const safeRunId = sanitizePathSegment(params.runId);
    const dir = path.join(traceRoot, safeThreadId);
    this.filePath = path.join(dir, `${safeRunId}.jsonl`);
    this.writeChain = mkdir(dir, { recursive: true }).then(() => undefined);
  }

  static create(params: { threadId: string; runId?: string }): TraceRecorder {
    return new TraceRecorder({ threadId: params.threadId, runId: params.runId ?? `run_${randomUUID()}` });
  }

  record(event: Omit<TraceEvent, "trace_id" | "run_id" | "thread_id" | "ts"> & { ts?: string }): void {
    const fullEvent: TraceEvent = {
      trace_id: this.traceId,
      run_id: this.runId,
      thread_id: this.threadId,
      ts: event.ts ?? nowIso(),
      ...event,
    };

    const line = `${JSON.stringify(fullEvent)}\n`;
    this.writeChain = this.writeChain
      .then(() => appendFile(this.filePath, line, "utf8"))
      .catch((error) => {
        console.warn("[trace] failed to write trace event", error);
      });
  }

  runStarted(input: unknown): void {
    this.record({ type: "run_started", input });
  }

  runEnded(status: TraceStatus, output?: unknown): void {
    this.record({ type: "run_ended", status, ...(output !== undefined ? { output } : {}) });
  }

  spanStarted(params: { spanId: string; name: string; agent: string; input?: unknown; metadata?: Record<string, unknown> }): void {
    this.spanStarts.set(params.spanId, Date.now());
    this.record({
      type: "span_started",
      span_id: params.spanId,
      name: params.name,
      agent: params.agent,
      ...(params.input !== undefined ? { input: params.input } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
  }

  spanEnded(params: {
    spanId: string;
    name: string;
    agent: string;
    status?: TraceStatus;
    output?: unknown;
    error?: unknown;
  }): void {
    const startedAt = this.spanStarts.get(params.spanId);
    if (startedAt != null) this.spanStarts.delete(params.spanId);
    this.record({
      type: "span_ended",
      span_id: params.spanId,
      name: params.name,
      agent: params.agent,
      status: params.status ?? "ok",
      ...(startedAt != null ? { duration_ms: Date.now() - startedAt } : {}),
      ...(params.output !== undefined ? { output: params.output } : {}),
      ...(params.error !== undefined ? { error: errorToString(params.error) } : {}),
    });
  }

  toolCallStarted(params: {
    spanId?: string;
    toolCallId: string;
    toolName: string;
    input?: unknown;
    agent?: string;
  }): void {
    this.toolStarts.set(params.toolCallId, Date.now());
    this.record({
      type: "tool_call_started",
      ...(params.spanId ? { span_id: params.spanId } : {}),
      ...(params.agent ? { agent: params.agent } : {}),
      tool_call_id: params.toolCallId,
      tool_name: params.toolName,
      ...(params.input !== undefined ? { input: params.input } : {}),
    });
  }

  toolCallEnded(params: {
    spanId?: string;
    toolCallId: string;
    toolName?: string;
    output?: unknown;
    error?: unknown;
    agent?: string;
  }): void {
    const startedAt = this.toolStarts.get(params.toolCallId);
    if (startedAt != null) this.toolStarts.delete(params.toolCallId);
    this.record({
      type: "tool_call_ended",
      ...(params.spanId ? { span_id: params.spanId } : {}),
      ...(params.agent ? { agent: params.agent } : {}),
      tool_call_id: params.toolCallId,
      ...(params.toolName ? { tool_name: params.toolName } : {}),
      status: params.error === undefined ? "ok" : "error",
      ...(startedAt != null ? { duration_ms: Date.now() - startedAt } : {}),
      ...(params.output !== undefined ? { output: params.output } : {}),
      ...(params.error !== undefined ? { error: errorToString(params.error) } : {}),
    });
  }

  message(params: { spanId?: string; agent?: string; metadata?: Record<string, unknown> }): void {
    this.record({
      type: "message",
      ...(params.spanId ? { span_id: params.spanId } : {}),
      ...(params.agent ? { agent: params.agent } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
  }

  interrupt(params: { spanId?: string; agent?: string; metadata?: Record<string, unknown> }): void {
    this.record({
      type: "interrupt",
      ...(params.spanId ? { span_id: params.spanId } : {}),
      ...(params.agent ? { agent: params.agent } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
  }

  error(error: unknown, params: { spanId?: string; agent?: string } = {}): void {
    this.record({
      type: "error",
      ...(params.spanId ? { span_id: params.spanId } : {}),
      ...(params.agent ? { agent: params.agent } : {}),
      error: errorToString(error),
    });
  }

  async flush(): Promise<void> {
    await this.writeChain.catch(() => undefined);
  }
}

export async function listTraceRuns(threadId: string): Promise<TraceRunSummary[]> {
  const dir = path.join(traceRoot, sanitizePathSegment(threadId));
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const runs = await Promise.all(
    entries
      .filter((name) => name.endsWith(".jsonl"))
      .map(async (name) => {
        const filePath = path.join(dir, name);
        const [info, content] = await Promise.all([stat(filePath), readFile(filePath, "utf8").catch(() => "")]);
        return {
          run_id: name.slice(0, -".jsonl".length),
          updated_at: info.mtime.toISOString(),
          event_count: countJsonlEvents(content),
        };
      }),
  );

  return runs.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export async function readTraceRun(threadId: string, runId: string): Promise<TraceEvent[]> {
  const filePath = path.join(traceRoot, sanitizePathSegment(threadId), `${sanitizePathSegment(runId)}.jsonl`);
  const content = await readFile(filePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as TraceEvent];
      } catch {
        return [];
      }
    });
}

export async function readLatestTraceRun(threadId: string): Promise<{ thread_id: string; run_id: string; events: TraceEvent[] } | null> {
  const [latest] = await listTraceRuns(threadId);
  if (!latest) return null;
  return {
    thread_id: threadId,
    run_id: latest.run_id,
    events: await readTraceRun(threadId, latest.run_id),
  };
}
