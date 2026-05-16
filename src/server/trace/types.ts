export type TraceStatus = "ok" | "error" | "aborted";

export type TraceEventType =
  | "run_started"
  | "run_ended"
  | "span_started"
  | "span_ended"
  | "tool_call_started"
  | "tool_call_ended"
  | "message"
  | "interrupt"
  | "error";

export type TraceEvent = {
  type: TraceEventType;
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
  status?: TraceStatus;
  duration_ms?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type TraceRunSummary = {
  run_id: string;
  updated_at: string;
  event_count: number;
};
