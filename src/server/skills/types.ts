export type SkillId = "systematic-literature-review" | "academic-paper-review" | "deep-research";

export type SkillPhase = "planner" | "researcher" | "reporter";

export type SkillDefinition = {
  id: SkillId;
  name: string;
  description: string;
  triggers: string[];
  plannerInstructions: string;
  researcherInstructions: string;
  reporterInstructions: string;
};

export type SkillSelectionResult = {
  activeSkills: SkillDefinition[];
  reason: string;
};
