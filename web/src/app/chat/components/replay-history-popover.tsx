// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { History, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import { listReplays } from "~/core/api/replays";
import type { ReplayRunSummary } from "~/core/api/types";
import { resetConversation } from "~/core/store";
import { cn } from "~/lib/utils";

function formatUpdatedAt(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ReplayHistoryPopover({ className }: { className?: string }) {
  const t = useTranslations("chat.messages");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [replays, setReplays] = useState<ReplayRunSummary[]>([]);

  useEffect(() => {
    if (!open) return;

    const abortController = new AbortController();
    setLoading(true);
    setError(false);

    listReplays({ limit: 50, abortSignal: abortController.signal })
      .then((items) => {
        setReplays(items);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to load replay history", error);
        setError(true);
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });

    return () => abortController.abort();
  }, [open]);

  const hasReplays = replays.length > 0;
  const renderedReplays = useMemo(
    () =>
      replays.map((replay) => ({
        ...replay,
        href: `/chat?replayThread=${encodeURIComponent(replay.thread_id)}&replayRun=${encodeURIComponent(replay.run_id)}`,
        updatedAtLabel: formatUpdatedAt(replay.updated_at, locale),
      })),
    [locale, replays],
  );

  const handleReplayClick = useCallback(
    (href: string) => {
      resetConversation();
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <History size={16} />
          {t("history")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b p-4">
          <div className="font-medium">{t("history")}</div>
          <div className="text-muted-foreground mt-1 text-sm">
            {t("historyDescription")}
          </div>
        </div>
        <ScrollArea className="max-h-96">
          <div className="p-2">
            {loading && (
              <div className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {t("loadingHistory")}
              </div>
            )}
            {!loading && error && (
              <div className="text-destructive p-3 text-sm">
                {t("historyLoadFailed")}
              </div>
            )}
            {!loading && !error && !hasReplays && (
              <div className="text-muted-foreground p-3 text-sm">
                {t("emptyHistory")}
              </div>
            )}
            {!loading && !error && hasReplays && (
              <div className="space-y-1">
                {renderedReplays.map((replay) => (
                  <button
                    key={`${replay.thread_id}:${replay.run_id}`}
                    type="button"
                    className={cn(
                      "hover:bg-accent hover:text-accent-foreground w-full rounded-md p-3 text-left transition-colors",
                      "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                    )}
                    onClick={() => handleReplayClick(replay.href)}
                  >
                    <div className="truncate text-sm font-medium">
                      {replay.title ?? t("untitledReplay")}
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center justify-between gap-3 text-xs">
                      <span>{replay.updatedAtLabel}</span>
                      <span>{t("eventCount", { count: replay.event_count })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
