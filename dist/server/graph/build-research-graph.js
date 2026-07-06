import { END, START, StateGraph } from "@langchain/langgraph";
import { routeAfterCoordinator, routeAfterPlanner } from "./routing.js";
import { ResearchGraphAnnotation } from "./state.js";
export function buildPlanningGraph(nodes) {
    return new StateGraph(ResearchGraphAnnotation)
        .addNode("coordinator", nodes.coordinator)
        .addNode("background_investigator", nodes.backgroundInvestigator)
        .addNode("planner", nodes.planner)
        .addNode("human_feedback", nodes.humanFeedback)
        .addEdge(START, "coordinator")
        .addConditionalEdges("coordinator", routeAfterCoordinator)
        .addEdge("background_investigator", "planner")
        .addConditionalEdges("planner", routeAfterPlanner)
        .addEdge("human_feedback", END)
        .compile();
}
export function buildExecutionGraph(nodes) {
    return new StateGraph(ResearchGraphAnnotation)
        .addNode("researcher", nodes.researcher)
        .addNode("reporter", nodes.reporter)
        .addEdge(START, "researcher")
        .addEdge("researcher", "reporter")
        .addEdge("reporter", END)
        .compile();
}
