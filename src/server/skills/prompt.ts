import type { SkillDefinition, SkillPhase } from "./types.js";

function instructionsForPhase(skill: SkillDefinition, phase: SkillPhase): string {
  if (phase === "planner") return skill.plannerInstructions;
  if (phase === "researcher") return skill.researcherInstructions;
  return skill.reporterInstructions;
}

export function formatSkillPromptBlock(skills: readonly SkillDefinition[], phase: SkillPhase): string {
  if (!skills.length) return "";
  const body = skills
    .map((skill) => [`Skill: ${skill.name} (${skill.id})`, `Instructions: ${instructionsForPhase(skill, phase)}`].join("\n"))
    .join("\n\n");

  return `<active_academic_skills phase="${phase}">\n${body}\n</active_academic_skills>`;
}
