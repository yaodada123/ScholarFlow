// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { resolveServiceURL } from "./resolve-service-url";

export type TraceEvent = {
  type: string;
  trace_id: string;
  run_id: string;
  thread_id: string;
  ts: string;
  span_id?: string;
  parent_span_id?: string;
  name?: string;
  agent?: string;
  tool_call_id?: string;
  tool_name?: string;
  status?: string;
  duration_ms?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type TraceRun = {
  thread_id: string;
  run_id: string;
  events: TraceEvent[];
};

export async function fetchLatestTrace(threadId: string): Promise<TraceRun | null> {
  const response = await fetch(resolveServiceURL(`traces/${encodeURIComponent(threadId)}/latest`));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch trace: ${response.status}`);
  return (await response.json()) as TraceRun;
}

export async function fetchTraceRun(threadId: string, runId: string): Promise<TraceRun | null> {
  const response = await fetch(
    resolveServiceURL(`traces/${encodeURIComponent(threadId)}/${encodeURIComponent(runId)}`),
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch trace: ${response.status}`);
  return (await response.json()) as TraceRun;
}
