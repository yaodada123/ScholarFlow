import type { LangGraphRunnableConfig } from "@langchain/langgraph";

import type { OpenAICompatibleClient } from "../../llm/openai-compatible.js";
import type { ChatRequest } from "../../schemas.js";
import type { ThreadStore } from "../../runtime/thread-store.js";
import type { TraceRecorder } from "../../trace/recorder.js";
import { emitGraphEvent } from "../trace-bridge.js";
import type { ChatEvent } from "../types.js";

export type NodeFactoryContext = {
  llm: OpenAICompatibleClient | null;
  store: ThreadStore;
  trace?: TraceRecorder;
  request: ChatRequest;
  getCurrentSpan: () => string | undefined;
  setCurrentSpan: (spanId: string | undefined) => void;
};

export function createNodeEmitter(ctx: Pick<NodeFactoryContext, "trace" | "getCurrentSpan">) {
  return (config: LangGraphRunnableConfig | undefined, event: ChatEvent) => {
    const currentSpanId = ctx.getCurrentSpan();
    emitGraphEvent({
      ...(config ? { config } : {}),
      event,
      ...(ctx.trace ? { trace: ctx.trace } : {}),
      ...(currentSpanId ? { currentSpanId } : {}),
    });
  };
}
