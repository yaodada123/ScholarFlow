import { Annotation } from "@langchain/langgraph";

import type { ChatRequest } from "../schemas.js";
import type { WorkflowState } from "../runtime/types.js";

export type ResearchGraphState = WorkflowState & {
  incomingText: string;
  interruptFeedback: ChatRequest["interrupt_feedback"];
  isFeedback: boolean;
  coordinatorAction: "direct_response" | "handoff_to_planner" | null;
  plannerShouldInterrupt: boolean;
  done: "none" | "direct_response" | "interrupt_ready";
};

export const ResearchGraphAnnotation = Annotation.Root({
  threadId: Annotation<string>(),
  locale: Annotation<string>(),
  researchTopic: Annotation<string>(),
  messages: Annotation<WorkflowState["messages"]>(),
  resources: Annotation<WorkflowState["resources"]>(),
  observations: Annotation<WorkflowState["observations"]>(),
  planIterations: Annotation<number>(),
  currentPlan: Annotation<WorkflowState["currentPlan"]>(),
  backgroundInvestigationResults: Annotation<WorkflowState["backgroundInvestigationResults"]>(),
  enableBackgroundInvestigation: Annotation<boolean>(),
  enableWebSearch: Annotation<boolean>(),
  maxPlanIterations: Annotation<number>(),
  maxStepNum: Annotation<number>(),
  maxSearchResults: Annotation<number>(),
  autoAcceptedPlan: Annotation<boolean>(),
  enableClarification: Annotation<boolean>(),
  maxClarificationRounds: Annotation<number>(),
  clarificationRounds: Annotation<number>(),
  clarificationContext: Annotation<WorkflowState["clarificationContext"]>(),
  reportStyle: Annotation<WorkflowState["reportStyle"]>(),
  activeSkills: Annotation<WorkflowState["activeSkills"]>(),
  skillSelectionReason: Annotation<WorkflowState["skillSelectionReason"]>(),
  incomingText: Annotation<string>(),
  interruptFeedback: Annotation<ChatRequest["interrupt_feedback"]>(),
  isFeedback: Annotation<boolean>(),
  coordinatorAction: Annotation<ResearchGraphState["coordinatorAction"]>(),
  plannerShouldInterrupt: Annotation<boolean>(),
  done: Annotation<ResearchGraphState["done"]>(),
});
