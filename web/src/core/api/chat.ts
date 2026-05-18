// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { env } from "~/env";

import type { MCPServerMetadata } from "../mcp";
import type { Resource } from "../messages";
import { parseReplaySourceFromSearchParams } from "../replay/get-replay-id";
import { fetchStream } from "../sse";
import type { AcademicSkillId } from "../store/settings-store";
import { sleep } from "../utils";

import { fetchApiReplayEvents } from "./replays";
import { resolveServiceURL } from "./resolve-service-url";
import type { ChatEvent } from "./types";

function getLocaleFromCookie(): string {
  if (typeof document === "undefined") return "en-US";
  
  // Map frontend locale codes to backend locale format
  // Frontend uses: "en", "zh"
  // Backend expects: "en-US", "zh-CN"
  const LOCALE_MAP = { "en": "en-US", "zh": "zh-CN" } as const;
  
  // Initialize to raw locale format (matches cookie format)
  let rawLocale = "en";
  
  // Read from cookie
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "NEXT_LOCALE" && value) {
      rawLocale = decodeURIComponent(value);
      break;
    }
  }
  
  // Map raw locale to backend format, fallback to en-US if unmapped
  return LOCALE_MAP[rawLocale as keyof typeof LOCALE_MAP] ?? "en-US";
}

export async function* chatStream(
  userMessage: string,
  params: {
    thread_id: string;
    resources?: Array<Resource>;
    workflow_mode?: "chat" | "research";
    auto_accepted_plan: boolean;
    enable_clarification?: boolean;
    max_clarification_rounds?: number;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
    enable_deep_thinking?: boolean;
    enable_background_investigation: boolean;
    enable_web_search?: boolean;
    enable_skills?: boolean;
    selected_skills?: AcademicSkillId[];
    report_style?: "academic" | "popular_science" | "news" | "social_media" | "strategic_investment";
    mcp_settings?: {
      servers: Record<
        string,
        MCPServerMetadata & {
          enabled_tools: string[];
          add_to_agents: string[];
        }
      >;
    };
  },
  options: { abortSignal?: AbortSignal } = {},
) {
  const urlParams = new URLSearchParams(location.search);
  if (
    env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY ||
    urlParams.has("mock") ||
    parseReplaySourceFromSearchParams(location.search) != null
  )
    return yield* chatReplayStream(userMessage, params, options);
  
  try{
    const locale = getLocaleFromCookie();
    const stream = fetchStream(resolveServiceURL("chat/stream"), {
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
        locale,
        ...params,
      }),
      signal: options.abortSignal,
    });
    
    for await (const event of stream) {
      yield {
        type: event.event,
        data: JSON.parse(event.data),
      } as ChatEvent;
    }
  }catch(e){
    console.error(e);
  }
}

async function* chatReplayStream(
  userMessage: string,
  params: {
    thread_id: string;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
  } = {
    thread_id: "__mock__",
    auto_accepted_plan: false,
    max_plan_iterations: 3,
    max_step_num: 1,
    max_search_results: 3,
    interrupt_feedback: undefined,
  },
  options: { abortSignal?: AbortSignal } = {},
): AsyncIterable<ChatEvent> {
  const urlParams = new URLSearchParams(window.location.search);
  let replayFilePath = "";
  if (urlParams.has("mock")) {
    if (urlParams.get("mock")) {
      replayFilePath = `/mock/${urlParams.get("mock")!}.txt`;
    } else {
      if (params.interrupt_feedback === "accepted") {
        replayFilePath = "/mock/final-answer.txt";
      } else if (params.interrupt_feedback === "edit_plan") {
        replayFilePath = "/mock/re-plan.txt";
      } else {
        replayFilePath = "/mock/first-plan.txt";
      }
    }
    fastForwardReplaying = true;
  } else {
    const replaySource = parseReplaySourceFromSearchParams(window.location.search);
    if (replaySource?.kind === "api") {
      const events = await fetchApiReplayEvents({
        threadId: replaySource.threadId,
        runId: replaySource.runId,
        abortSignal: options.abortSignal,
      });
      yield* yieldReplayEventsWithTiming(events);
      return;
    }
    if (replaySource?.kind === "static" && replaySource.replayId) {
      replayFilePath = `/replay/${replaySource.replayId}.txt`;
    } else {
      // Fallback to a default replay
      replayFilePath = `/replay/eiffel-tower-vs-tallest-building.txt`;
    }
  }

  const text = await fetchReplay(replayFilePath, {
    abortSignal: options.abortSignal,
  });
  yield* yieldReplayEventsWithTiming(parseReplayText(text));
}

function parseReplayText(text: string): ChatEvent[] {
  const normalizedText = text.replace(/\r\n/g, "\n");
  const chunks = normalizedText.split("\n\n");
  const events: ChatEvent[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const eventRaw = lines.find((line) => line.startsWith("event: "));
    const dataLines = lines
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length));
    if (!eventRaw || dataLines.length === 0) continue;

    try {
      events.push({
        type: eventRaw.slice("event: ".length),
        data: JSON.parse(dataLines.join("\n")),
      } as ChatEvent);
    } catch (e) {
      console.error(e);
    }
  }
  return events;
}

async function* yieldReplayEventsWithTiming(events: Iterable<ChatEvent>): AsyncIterable<ChatEvent> {
  for (const chatEvent of events) {
    if (chatEvent.type === "message_chunk") {
      if (!chatEvent.data.finish_reason) {
        await sleepInReplay(50);
      }
    } else if (chatEvent.type === "tool_call_result") {
      await sleepInReplay(500);
    }
    yield chatEvent;
    if (chatEvent.type === "tool_call_result") {
      await sleepInReplay(800);
    } else if (chatEvent.type === "message_chunk") {
      if (chatEvent.data.role === "user") {
        await sleepInReplay(500);
      }
    }
  }
}

const replayCache = new Map<string, string>();
export async function fetchReplay(
  url: string,
  options: { abortSignal?: AbortSignal } = {},
) {
  if (replayCache.has(url)) {
    return replayCache.get(url)!;
  }
  const res = await fetch(url, {
    signal: options.abortSignal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch replay: ${res.statusText}`);
  }
  const text = await res.text();
  replayCache.set(url, text);
  return text;
}

export async function fetchReplayTitle() {
  const res = chatReplayStream(
    "",
    {
      thread_id: "__mock__",
      auto_accepted_plan: false,
      max_plan_iterations: 3,
      max_step_num: 1,
      max_search_results: 3,
    },
    {},
  );
  for await (const event of res) {
    if (event.type === "message_chunk") {
      return event.data.content;
    }
  }
}

export async function sleepInReplay(ms: number) {
  if (fastForwardReplaying) {
    await sleep(0);
  } else {
    await sleep(ms);
  }
}

let fastForwardReplaying = false;
export function fastForwardReplay(value: boolean) {
  fastForwardReplaying = value;
}
