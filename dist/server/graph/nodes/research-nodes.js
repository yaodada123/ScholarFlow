import { createBackgroundInvestigatorNode } from "./background-investigator.js";
import { createCoordinatorNode } from "./coordinator.js";
import { createHumanFeedbackNode } from "./human-feedback.js";
import { createPlannerNode } from "./planner.js";
import { createReporterNode } from "./reporter.js";
import { createResearcherNode } from "./researcher.js";
export function createPlanningNodes(ctx) {
    return {
        coordinator: createCoordinatorNode(ctx),
        backgroundInvestigator: createBackgroundInvestigatorNode(ctx),
        planner: createPlannerNode(ctx),
        humanFeedback: createHumanFeedbackNode(ctx),
    };
}
export function createExecutionNodes(ctx) {
    return {
        researcher: createResearcherNode(ctx),
        reporter: createReporterNode(ctx),
    };
}
