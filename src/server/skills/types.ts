export type SkillId =
  | "systematic-literature-review"
  | "academic-paper-review"
  | "deep-research"
  | "research-report"
  | "proposal-report";

export type SkillPhase = "planner" | "researcher" | "reporter";

export type EvidencePolicy = {
  minimumSourceCount?: number;
  preferredSourceTypes: string[];
  citationStyle: string;
  rules: string[];
};

export type EvaluationRubricCriterion = {
  name: string;
  description: string;
};

export type SkillDefinition = {
  id: SkillId;
  name: string;
  description: string;
  triggers: string[];
  plannerInstructions: string;
  researcherInstructions: string;
  reporterInstructions: string;
  reportTemplate: string;
  requiredSections: string[];
  evidencePolicy: EvidencePolicy;
  figureSuggestions: string[];
  evaluationRubric: EvaluationRubricCriterion[];
};

export type SkillSelectionResult = {
  activeSkills: SkillDefinition[];
  reason: string;
};
