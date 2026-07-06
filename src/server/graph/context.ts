import type { ChatRequest } from "../schemas.js";
import type { ThreadStore } from "../runtime/thread-store.js";
import type { TraceRecorder } from "../trace/recorder.js";
import type { OpenAICompatibleClient } from "../llm/openai-compatible.js";

export type ResearchGraphContext = {
  request: ChatRequest;
  store: ThreadStore;
  incomingText: string;
  isFeedback: boolean;
  llm: OpenAICompatibleClient | null;
  signal?: AbortSignal;
  trace?: TraceRecorder;
};
