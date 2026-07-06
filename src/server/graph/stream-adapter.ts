import type { ChatEvent } from "./types.js";

export async function* streamResearchGraphEvents<TState>(params: {
  stream: AsyncIterable<unknown>;
  onState: (state: TState) => void;
}): AsyncIterable<ChatEvent> {
  for await (const chunk of params.stream) {
    if (Array.isArray(chunk) && chunk.length === 2) {
      const [mode, payload] = chunk;
      if (mode === "custom") yield payload as ChatEvent;
      if (mode === "values") params.onState(payload as TState);
    }
  }
}
