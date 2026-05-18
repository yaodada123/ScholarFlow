import { resolveServiceURL } from "./resolve-service-url";
import type { ChatEvent, ReplayRunSummary } from "./types";

export async function listReplays(options: { limit?: number; abortSignal?: AbortSignal } = {}): Promise<ReplayRunSummary[]> {
  const url = new URL(resolveServiceURL("replays"));
  if (options.limit != null) url.searchParams.set("limit", String(options.limit));

  const res = await fetch(url, { signal: options.abortSignal });
  if (!res.ok) throw new Error(`Failed to fetch replays: ${res.statusText}`);
  const json = (await res.json()) as { replays?: ReplayRunSummary[] };
  return Array.isArray(json.replays) ? json.replays : [];
}

export async function fetchApiReplayEvents(params: {
  threadId: string;
  runId: string;
  abortSignal?: AbortSignal;
}): Promise<ChatEvent[]> {
  const url = resolveServiceURL(
    `replays/${encodeURIComponent(params.threadId)}/${encodeURIComponent(params.runId)}`,
  );
  const res = await fetch(url, { signal: params.abortSignal });
  if (!res.ok) throw new Error(`Failed to fetch replay: ${res.statusText}`);
  const json = (await res.json()) as { events?: ChatEvent[] };
  return Array.isArray(json.events) ? json.events : [];
}
