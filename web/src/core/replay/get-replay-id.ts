// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

export type ReplaySource =
  | { kind: "static"; replayId: string | null }
  | { kind: "api"; threadId: string; runId: string }
  | null;

export function parseReplaySourceFromSearchParams(params: string): ReplaySource {
  const urlParams = new URLSearchParams(params);
  const threadId = urlParams.get("replayThread");
  const runId = urlParams.get("replayRun");
  if (threadId && runId) return { kind: "api", threadId, runId };
  if (urlParams.has("replay")) return { kind: "static", replayId: urlParams.get("replay") };
  return null;
}

export function extractReplayIdFromSearchParams(params: string) {
  const source = parseReplaySourceFromSearchParams(params);
  return source?.kind === "static" ? source.replayId : null;
}
