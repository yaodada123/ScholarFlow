import type { SkillDefinition, SkillPhase } from "./types.js";

function instructionsForPhase(skill: SkillDefinition, phase: SkillPhase): string {
  if (phase === "planner") return skill.plannerInstructions;
  if (phase === "researcher") return skill.researcherInstructions;
  return skill.reporterInstructions;
}

function formatList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatRubric(skill: SkillDefinition): string {
  return skill.evaluationRubric.map((criterion) => `- ${criterion.name}: ${criterion.description}`).join("\n");
}

function reportGuidanceForPhase(skill: SkillDefinition, phase: SkillPhase): string[] {
  if (phase === "planner") {
    return [
      `Report template: ${skill.reportTemplate}`,
      `Required final sections to plan for:\n${formatList(skill.requiredSections)}`,
      `Evidence policy: aim for at least ${skill.evidencePolicy.minimumSourceCount ?? "enough"} source(s); prefer ${skill.evidencePolicy.preferredSourceTypes.join(", ")}.`,
      `Suggested figures/tables to consider:\n${formatList(skill.figureSuggestions)}`,
    ];
  }

  if (phase === "researcher") {
    return [
      `Evidence policy: ${skill.evidencePolicy.citationStyle}`,
      `Preferred source types: ${skill.evidencePolicy.preferredSourceTypes.join(", ")}.`,
      `Evidence rules:\n${formatList(skill.evidencePolicy.rules)}`,
      `Collect material for required sections:\n${formatList(skill.requiredSections)}`,
    ];
  }

  return [
    `Report template: ${skill.reportTemplate}`,
    `Required sections, in order unless the user asks otherwise:\n${formatList(skill.requiredSections)}`,
    `Evidence policy: ${skill.evidencePolicy.citationStyle}`,
    `Evidence rules:\n${formatList(skill.evidencePolicy.rules)}`,
    `Recommended figures/tables to include when supported by evidence:\n${formatList(skill.figureSuggestions)}`,
    `Self-evaluation rubric:\n${formatRubric(skill)}`,
  ];
}

export function formatSkillPromptBlock(skills: readonly SkillDefinition[], phase: SkillPhase): string {
  if (!skills.length) return "";
  const body = skills
    .map((skill) =>
      [
        `Skill: ${skill.name} (${skill.id})`,
        `Instructions: ${instructionsForPhase(skill, phase)}`,
        ...reportGuidanceForPhase(skill, phase),
      ].join("\n"),
    )
    .join("\n\n");

  return `<active_academic_skills phase="${phase}">\n${body}\n</active_academic_skills>`;
}
