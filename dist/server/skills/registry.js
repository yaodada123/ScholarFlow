export const skillRegistry = {
    "systematic-literature-review": {
        id: "systematic-literature-review",
        name: "Systematic Literature Review",
        description: "Use for literature reviews, surveys, annotated bibliographies, and cross-paper synthesis across multiple academic papers.",
        triggers: [
            "systematic review",
            "literature review",
            "survey",
            "annotated bibliography",
            "文献综述",
            "综述",
        ],
        plannerInstructions: "Plan breadth-first academic synthesis. Clarify topic scope, paper count or time window when available, citation expectations, and evaluation dimensions. The plan should include search strategy, inclusion/exclusion criteria, thematic synthesis, gaps, and per-paper annotation needs.",
        researcherInstructions: "Prioritize academic search and selected research resources. Use concise core keywords rather than the full user prompt. Gather enough papers to identify themes, convergences, disagreements, methods, limitations, and gaps. Do not pad results if evidence is sparse.",
        reporterInstructions: "Write a structured literature review with methodology, search scope, theme synthesis, convergences, disagreements, research gaps, per-paper annotations when evidence supports them, limitations, and references. Make clear when the source set is too small or heterogeneous for strong synthesis.",
    },
    "academic-paper-review": {
        id: "academic-paper-review",
        name: "Academic Paper Review",
        description: "Use for reviewing, critiquing, analyzing, or summarizing a single academic paper, preprint, study, or uploaded PDF.",
        triggers: [
            "review this paper",
            "peer review",
            "critique this paper",
            "paper review",
            "论文评审",
            "审稿",
            "arxiv.org/abs/",
        ],
        plannerInstructions: "Plan a peer-review-style analysis of the paper. Identify required metadata, claimed contributions, methodology, evidence, related-work positioning, strengths, weaknesses, and review recommendation. If full text is unavailable, plan around available abstracts or uploaded excerpts and explicitly track evidence limits.",
        researcherInstructions: "Prioritize uploaded paper content and selected resources before external search. Extract metadata, claims, methods, experiments, results, and limitations. Use academic search to position the work against related studies when needed. Preserve uncertainty if only abstract-level evidence is available.",
        reporterInstructions: "Use a peer-review template: metadata, executive summary, contribution summary, strengths, weaknesses, methodology assessment table, literature positioning, questions for authors, recommendation, confidence, contribution level, and actionable suggestions. Ground every critique in available paper evidence and note missing full-text limitations.",
    },
    "deep-research": {
        id: "deep-research",
        name: "Deep Research",
        description: "Use for broad research, investigation, comparison, explanations, or report generation that needs multi-angle evidence synthesis.",
        triggers: ["research", "investigate", "compare", "explain", "what is", "调研", "研究一下", "对比"],
        plannerInstructions: "Plan a multi-angle investigation instead of a single-pass answer. Identify dimensions such as facts/data, examples, expert perspectives, trends, comparisons, challenges, and limitations. Include how the final synthesis will balance evidence from different source types.",
        researcherInstructions: "Collect evidence from multiple angles where tools are available: academic sources, selected resources, and web results. Look for concrete data, examples, current context, expert perspectives, alternatives, and criticisms. Avoid over-relying on a single source type.",
        reporterInstructions: "Produce a source-grounded synthesis that covers key facts, examples, current trends, expert or authoritative perspectives, comparisons, limitations, and practical implications. Distinguish established evidence from uncertain or incomplete findings.",
    },
};
export const allSkills = Object.values(skillRegistry);
export function getSkill(id) {
    return skillRegistry[id];
}
export function getSkills(ids) {
    return ids.map((id) => skillRegistry[id]).filter(Boolean);
}
