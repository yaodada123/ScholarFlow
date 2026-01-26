import type { ChatRequest, Resource } from "../schemas.js";
import type { Plan } from "../workflow.js";

export type Agent = "coordinator" | "planner" | "researcher" | "coder" | "reporter";

export type ChatRole = "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  agent?: Agent;
};

export type WorkflowState = {
  threadId: string;
  locale: string;
  researchTopic: string;
  messages: ChatMessage[];
  resources: Resource[];
  observations: string[];
  planIterations: number;
  currentPlan: Plan | null;
  backgroundInvestigationResults: string | null;
  enableBackgroundInvestigation: boolean;
  enableWebSearch: boolean;
  maxPlanIterations: number;
  maxStepNum: number;
  maxSearchResults: number;
  autoAcceptedPlan: boolean;
  reportStyle: ChatRequest["report_style"];
};

export type Command = {
  goto: NodeName;
  update?: Partial<WorkflowState>;
};

export type NodeName =
  | "coordinator"
  | "background_investigator"
  | "planner"
  | "human_feedback"
  | "researcher"
  | "reporter"
  | "__end__";

