function instructionsForPhase(skill, phase) {
    if (phase === "planner")
        return skill.plannerInstructions;
    if (phase === "researcher")
        return skill.researcherInstructions;
    return skill.reporterInstructions;
}
export function formatSkillPromptBlock(skills, phase) {
    if (!skills.length)
        return "";
    const body = skills
        .map((skill) => [`Skill: ${skill.name} (${skill.id})`, `Instructions: ${instructionsForPhase(skill, phase)}`].join("\n"))
        .join("\n\n");
    return `<active_academic_skills phase="${phase}">\n${body}\n</active_academic_skills>`;
}
