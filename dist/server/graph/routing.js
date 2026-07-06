import { END } from "@langchain/langgraph";
export function routeAfterCoordinator(state) {
    if (state.coordinatorAction === "direct_response")
        return END;
    const shouldPlan = !state.interruptFeedback || state.interruptFeedback === "edit_plan";
    if (shouldPlan && state.enableBackgroundInvestigation && state.enableWebSearch)
        return "background_investigator";
    return "planner";
}
export function routeAfterPlanner(state) {
    return state.plannerShouldInterrupt ? "human_feedback" : END;
}
