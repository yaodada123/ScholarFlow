import { END } from "@langchain/langgraph";

import type { ResearchGraphState } from "./state.js";

export function routeAfterCoordinator(state: ResearchGraphState): typeof END | "background_investigator" | "planner" {
  if (state.coordinatorAction === "direct_response") return END;
  const shouldPlan = !state.interruptFeedback || state.interruptFeedback === "edit_plan";
  if (shouldPlan && state.enableBackgroundInvestigation && state.enableWebSearch) return "background_investigator";
  return "planner";
}

export function routeAfterPlanner(state: ResearchGraphState): typeof END | "human_feedback" {
  return state.plannerShouldInterrupt ? "human_feedback" : END;
}
