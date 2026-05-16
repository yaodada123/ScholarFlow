// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { CheckCircle2, Clock3, RefreshCcw, Timer, Wrench, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { fetchLatestTrace, type TraceEvent } from "~/core/api";
import { cn } from "~/lib/utils";

type SpanView = {
  spanId: string;
  name: string;
  agent?: string;
  status?: string;
  durationMs?: number;
  startedAt?: string;
  endedAt?: string;
  tools: ToolView[];
};

type ToolView = {
  toolCallId: string;
  name: string;
  status?: string;
  durationMs?: number;
  startedAt?: string;
  endedAt?: string;
};

function formatDuration(ms?: number): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function statusClassName(status?: string): string {
  if (status === "error") return "border-red-200 bg-red-50 text-red-700";
  if (status === "aborted") return "border-yellow-200 bg-yellow-50 text-yellow-700";
  if (status === "ok") return "border-green-200 bg-green-50 text-green-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function statusIcon(status?: string) {
  if (status === "error") return <XCircle className="h-3.5 w-3.5" />;
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <Clock3 className="h-3.5 w-3.5" />;
}

function findLastEvent(events: TraceEvent[], type: string): TraceEvent | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.type === type) return event;
  }
  return undefined;
}

function buildSpanViews(events: TraceEvent[]): SpanView[] {
  const spans = new Map<string, SpanView>();
  const tools = new Map<string, ToolView & { spanId?: string }>();

  for (const event of events) {
    if (event.type === "span_started" && event.span_id) {
      const existing = spans.get(event.span_id);
      spans.set(event.span_id, {
        spanId: event.span_id,
        name: event.name ?? event.span_id,
        agent: event.agent,
        status: existing?.status,
        durationMs: existing?.durationMs,
        startedAt: event.ts,
        endedAt: existing?.endedAt,
        tools: existing?.tools ?? [],
      });
    }

    if (event.type === "span_ended" && event.span_id) {
      const existing = spans.get(event.span_id);
      spans.set(event.span_id, {
        spanId: event.span_id,
        name: event.name ?? existing?.name ?? event.span_id,
        agent: event.agent ?? existing?.agent,
        status: event.status,
        durationMs: event.duration_ms,
        startedAt: existing?.startedAt,
        endedAt: event.ts,
        tools: existing?.tools ?? [],
      });
    }

    if (event.type === "tool_call_started" && event.tool_call_id) {
      const existing = tools.get(event.tool_call_id);
      tools.set(event.tool_call_id, {
        toolCallId: event.tool_call_id,
        name: event.tool_name ?? existing?.name ?? event.tool_call_id,
        status: existing?.status,
        durationMs: existing?.durationMs,
        startedAt: event.ts,
        endedAt: existing?.endedAt,
        spanId: event.span_id ?? existing?.spanId,
      });
    }

    if (event.type === "tool_call_ended" && event.tool_call_id) {
      const existing = tools.get(event.tool_call_id);
      tools.set(event.tool_call_id, {
        toolCallId: event.tool_call_id,
        name: event.tool_name ?? existing?.name ?? event.tool_call_id,
        status: event.status,
        durationMs: event.duration_ms,
        startedAt: existing?.startedAt,
        endedAt: event.ts,
        spanId: event.span_id ?? existing?.spanId,
      });
    }
  }

  for (const tool of tools.values()) {
    if (!tool.spanId) continue;
    const span = spans.get(tool.spanId);
    if (!span) continue;
    span.tools.push(tool);
  }

  return [...spans.values()].sort((a, b) => Date.parse(a.startedAt ?? "") - Date.parse(b.startedAt ?? ""));
}

export function AgentTraceBlock({
  className,
  threadId,
  active,
}: {
  className?: string;
  threadId: string;
  active: boolean;
}) {
  const t = useTranslations("chat.research.trace");
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrace = async () => {
    setLoading(true);
    setError(null);
    try {
      const trace = await fetchLatestTrace(threadId);
      setRunId(trace?.run_id ?? null);
      setEvents(trace?.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    void loadTrace();
    const timer = window.setInterval(() => {
      void loadTrace();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [active, threadId]);

  const spans = useMemo(() => buildSpanViews(events), [events]);
  const runEnded = findLastEvent(events, "run_ended");
  const runStarted = events.find((event) => event.type === "run_started");

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t("title")}</div>
            <div className="mt-1 max-w-[36rem] truncate text-xs text-muted-foreground">
              {runId ? `${t("run")}: ${runId}` : t("noTrace")}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadTrace()} disabled={loading}>
            <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            {t("refresh")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className={statusClassName(runEnded?.status)}>
            {statusIcon(runEnded?.status)}
            <span className="ml-1">{runEnded?.status ?? "running"}</span>
          </Badge>
          <Badge variant="outline">
            <Timer className="mr-1 h-3.5 w-3.5" />
            {formatDuration(runEnded?.duration_ms)}
          </Badge>
          <Badge variant="outline">{events.length} events</Badge>
        </div>
        {typeof runStarted?.input === "object" && runStarted.input !== null && "query" in runStarted.input && (
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {String((runStarted.input as { query?: unknown }).query ?? "")}
          </div>
        )}
        {error && <div className="text-xs text-red-600">{error}</div>}
      </Card>

      {spans.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">{loading ? t("loading") : t("empty")}</Card>
      ) : (
        <div className="space-y-3">
          {spans.map((span) => (
            <Card key={span.spanId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{span.agent ?? span.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{span.name}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Badge variant="outline" className={statusClassName(span.status)}>
                    {statusIcon(span.status)}
                    <span className="ml-1">{span.status ?? "running"}</span>
                  </Badge>
                  <Badge variant="outline">{formatDuration(span.durationMs)}</Badge>
                </div>
              </div>
              {span.tools.length > 0 && (
                <div className="mt-4 space-y-2 border-l pl-3">
                  {span.tools.map((tool) => (
                    <div key={tool.toolCallId} className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{tool.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-muted-foreground">{formatDuration(tool.durationMs)}</span>
                        <Badge variant="outline" className={statusClassName(tool.status)}>
                          {tool.status ?? "running"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
