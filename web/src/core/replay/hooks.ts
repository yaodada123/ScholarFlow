// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { env } from "~/env";

import { parseReplaySourceFromSearchParams } from "./get-replay-id";

export function useReplay() {
  const searchParams = useSearchParams();
  const replaySource = useMemo(
    () => parseReplaySourceFromSearchParams(searchParams.toString()),
    [searchParams],
  );
  return {
    isReplay: replaySource != null || env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY,
    replayId: replaySource?.kind === "static" ? replaySource.replayId : null,
    replaySource,
  };
}
