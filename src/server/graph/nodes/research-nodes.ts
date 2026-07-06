import type { ExecutionGraphNodes, PlanningGraphNodes } from "../build-research-graph.js";
import type { NodeFactoryContext } from "./context.js";
import { createBackgroundInvestigatorNode } from "./background-investigator.js";
import { createCoordinatorNode } from "./coordinator.js";
import { createHumanFeedbackNode } from "./human-feedback.js";
import { createPlannerNode } from "./planner.js";
import { createReporterNode } from "./reporter.js";
import { createResearcherNode } from "./researcher.js";

export function createPlanningNodes(ctx: NodeFactoryContext): PlanningGraphNodes {
  return {
    coordinator: createCoordinatorNode(ctx),
    backgroundInvestigator: createBackgroundInvestigatorNode(ctx),
    planner: createPlannerNode(ctx),
    humanFeedback: createHumanFeedbackNode(ctx),
  };
}

export function createExecutionNodes(ctx: NodeFactoryContext): ExecutionGraphNodes {
  return {
    researcher: createResearcherNode(ctx),
    reporter: createReporterNode(ctx),
  };
}
