import type { LangGraphRunnableConfig } from "@langchain/langgraph";

import type { ResearchGraphState } from "../state.js";

export type ResearchGraphNode = (
  state: ResearchGraphState,
  config?: LangGraphRunnableConfig,
) => Promise<Partial<ResearchGraphState>>;
