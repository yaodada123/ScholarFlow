import { END, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";

import { routeAfterCoordinator, routeAfterPlanner } from "./routing.js";
import { ResearchGraphAnnotation, type ResearchGraphState } from "./state.js";

type ResearchNode = (state: ResearchGraphState, config?: LangGraphRunnableConfig) => Promise<Partial<ResearchGraphState>>;

export type PlanningGraphNodes = {
  coordinator: ResearchNode;
  backgroundInvestigator: ResearchNode;
  planner: ResearchNode;
  humanFeedback: ResearchNode;
};

export type ExecutionGraphNodes = {
  researcher: ResearchNode;
  reporter: ResearchNode;
};

export function buildPlanningGraph(nodes: PlanningGraphNodes) {
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

export function buildExecutionGraph(nodes: ExecutionGraphNodes) {
  return new StateGraph(ResearchGraphAnnotation)
    .addNode("researcher", nodes.researcher)
    .addNode("reporter", nodes.reporter)
    .addEdge(START, "researcher")
    .addEdge("researcher", "reporter")
    .addEdge("reporter", END)
    .compile();
}
