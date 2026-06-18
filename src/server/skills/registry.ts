import type { EvaluationRubricCriterion, EvidencePolicy, SkillDefinition, SkillId } from "./types.js";

const academicCitationPolicy: EvidencePolicy = {
  minimumSourceCount: 4,
  preferredSourceTypes: ["peer-reviewed papers", "preprints", "books", "official datasets", "uploaded resources"],
  citationStyle: "Use bracketed source IDs from the provided Sources list, such as [S1].",
  rules: [
    "Ground substantive factual claims, comparisons, and recommendations in provided observations or source IDs.",
    "Prefer primary scholarly evidence over secondary summaries when both are available.",
    "State evidence gaps explicitly instead of inventing citations or unsupported findings.",
    "Separate established findings from hypotheses, interpretations, and practical recommendations.",
  ],
};

const defaultRubric: EvaluationRubricCriterion[] = [
  {
    name: "Evidence grounding",
    description: "Major claims are traceable to sources, and unsupported areas are marked as evidence gaps.",
  },
  {
    name: "Academic structure",
    description: "The report follows the required section order and uses concise scholarly prose.",
  },
  {
    name: "Analytical depth",
    description: "The report synthesizes, compares, and critiques evidence rather than listing facts only.",
  },
  {
    name: "Limitations and uncertainty",
    description: "Method, source, and scope limitations are clearly disclosed.",
  },
];

export const skillRegistry: Record<SkillId, SkillDefinition> = {
  "systematic-literature-review": {
    id: "systematic-literature-review",
    name: "Systematic Literature Review",
    description:
      "Use for literature reviews, surveys, annotated bibliographies, and cross-paper synthesis across multiple academic papers.",
    triggers: [
      "systematic review",
      "literature review",
      "survey",
      "annotated bibliography",
      "文献综述",
      "综述",
    ],
    plannerInstructions:
      "Plan breadth-first academic synthesis. Clarify topic scope, paper count or time window when available, citation expectations, and evaluation dimensions. The plan should include search strategy, inclusion/exclusion criteria, thematic synthesis, gaps, and per-paper annotation needs.",
    researcherInstructions:
      "Prioritize academic search and selected research resources. Use concise core keywords rather than the full user prompt. Gather enough papers to identify themes, convergences, disagreements, methods, limitations, and gaps. Do not pad results if evidence is sparse.",
    reporterInstructions:
      "Write a structured literature review with methodology, search scope, theme synthesis, convergences, disagreements, research gaps, per-paper annotations when evidence supports them, limitations, and references. Make clear when the source set is too small or heterogeneous for strong synthesis.",
    reportTemplate:
      "Systematic literature review: define the review question, summarize search scope and screening criteria, synthesize themes across studies, compare methods and findings, identify gaps, and close with implications for future research.",
    requiredSections: [
      "Title and Executive Summary",
      "Review Question and Scope",
      "Search Strategy and Inclusion/Exclusion Criteria",
      "Study Landscape",
      "Thematic Synthesis",
      "Method and Evidence Comparison",
      "Research Gaps and Future Directions",
      "Limitations of This Review",
      "References",
    ],
    evidencePolicy: {
      ...academicCitationPolicy,
      minimumSourceCount: 8,
      preferredSourceTypes: ["peer-reviewed papers", "systematic reviews", "preprints", "uploaded papers"],
      rules: [
        ...academicCitationPolicy.rules,
        "Report search terms, date or venue scope, and inclusion/exclusion criteria when evidence is available.",
        "Do not claim systematic coverage if the available source set is opportunistic or too small.",
      ],
    },
    figureSuggestions: [
      "PRISMA-style search and screening flow when source counts are known",
      "Theme-by-study evidence matrix",
      "Timeline of major papers or methods",
      "Gap map crossing research themes with methods or populations",
    ],
    evaluationRubric: [
      ...defaultRubric,
      {
        name: "Synthesis quality",
        description: "Themes, disagreements, and gaps are synthesized across studies instead of summarized paper-by-paper only.",
      },
    ],
  },
  "academic-paper-review": {
    id: "academic-paper-review",
    name: "Academic Paper Review",
    description:
      "Use for reviewing, critiquing, analyzing, or summarizing a single academic paper, preprint, study, or uploaded PDF.",
    triggers: [
      "review this paper",
      "peer review",
      "critique this paper",
      "paper review",
      "论文评审",
      "审稿",
      "arxiv.org/abs/",
    ],
    plannerInstructions:
      "Plan a peer-review-style analysis of the paper. Identify required metadata, claimed contributions, methodology, evidence, related-work positioning, strengths, weaknesses, and review recommendation. If full text is unavailable, plan around available abstracts or uploaded excerpts and explicitly track evidence limits.",
    researcherInstructions:
      "Prioritize uploaded paper content and selected resources before external search. Extract metadata, claims, methods, experiments, results, and limitations. Use academic search to position the work against related studies when needed. Preserve uncertainty if only abstract-level evidence is available.",
    reporterInstructions:
      "Use a peer-review template: metadata, executive summary, contribution summary, strengths, weaknesses, methodology assessment table, literature positioning, questions for authors, recommendation, confidence, contribution level, and actionable suggestions. Ground every critique in available paper evidence and note missing full-text limitations.",
    reportTemplate:
      "Peer-review report: identify the paper, summarize its contribution, assess soundness and novelty, list major and minor concerns, ask author questions, and provide a recommendation with confidence.",
    requiredSections: [
      "Paper Metadata",
      "Executive Summary",
      "Claimed Contributions",
      "Strengths",
      "Major Concerns",
      "Minor Concerns",
      "Methodology and Evidence Assessment",
      "Relation to Prior Work",
      "Questions for Authors",
      "Recommendation and Confidence",
    ],
    evidencePolicy: {
      ...academicCitationPolicy,
      minimumSourceCount: 1,
      preferredSourceTypes: ["uploaded paper", "paper abstract", "publisher page", "related peer-reviewed papers"],
      rules: [
        "Ground critiques in the paper text, abstract, figures, tables, or provided excerpts.",
        "Clearly distinguish paper-internal evidence from external related-work context.",
        "If full text is unavailable, limit the recommendation confidence and state which sections could not be reviewed.",
        "Do not infer experiments, datasets, or claims that are not present in available evidence.",
      ],
    },
    figureSuggestions: [
      "Contribution-to-evidence assessment table",
      "Strength/weakness severity matrix",
      "Method pipeline diagram reconstructed from the paper when supported",
      "Comparison table against closely related work",
    ],
    evaluationRubric: [
      ...defaultRubric,
      {
        name: "Review actionability",
        description: "Concerns are specific, prioritized, and paired with actionable suggestions for authors.",
      },
    ],
  },
  "deep-research": {
    id: "deep-research",
    name: "Deep Research",
    description:
      "Use for broad research, investigation, comparison, explanations, or report generation that needs multi-angle evidence synthesis.",
    triggers: ["research", "investigate", "compare", "explain", "what is", "调研", "研究一下", "对比"],
    plannerInstructions:
      "Plan a multi-angle investigation instead of a single-pass answer. Identify dimensions such as facts/data, examples, expert perspectives, trends, comparisons, challenges, and limitations. Include how the final synthesis will balance evidence from different source types.",
    researcherInstructions:
      "Collect evidence from multiple angles where tools are available: academic sources, selected resources, and web results. Look for concrete data, examples, current context, expert perspectives, alternatives, and criticisms. Avoid over-relying on a single source type.",
    reporterInstructions:
      "Produce a source-grounded synthesis that covers key facts, examples, current trends, expert or authoritative perspectives, comparisons, limitations, and practical implications. Distinguish established evidence from uncertain or incomplete findings.",
    reportTemplate:
      "Deep research brief: define the question, organize findings by investigation angle, compare evidence and viewpoints, identify uncertainties, and conclude with implications or next steps.",
    requiredSections: [
      "Executive Summary",
      "Research Question and Scope",
      "Key Findings",
      "Evidence by Investigation Angle",
      "Comparative Analysis",
      "Uncertainties and Limitations",
      "Implications",
      "References",
    ],
    evidencePolicy: {
      ...academicCitationPolicy,
      minimumSourceCount: 5,
      preferredSourceTypes: ["academic papers", "official reports", "datasets", "reputable web sources", "uploaded resources"],
    },
    figureSuggestions: [
      "Evidence map by investigation angle",
      "Comparison matrix for alternatives or viewpoints",
      "Timeline of developments when the topic is historical or current",
      "Risk/uncertainty matrix",
    ],
    evaluationRubric: [
      ...defaultRubric,
      {
        name: "Coverage balance",
        description: "The report covers multiple relevant angles without over-weighting one source type or viewpoint.",
      },
    ],
  },
  "research-report": {
    id: "research-report",
    name: "Research Report",
    description:
      "Use for complete academic research reports that need a polished paper-like structure, evidence tables, analysis, and references.",
    triggers: ["research report", "write a report", "full report", "academic report", "研究报告", "调研报告", "完整报告"],
    plannerInstructions:
      "Plan a complete report deliverable. Define the research question, scope, candidate argument or thesis, evidence collection plan, analysis dimensions, expected tables or figures, and limitations to disclose.",
    researcherInstructions:
      "Collect enough evidence to support a complete report structure. Prioritize authoritative academic and official sources, extract quotable findings with source IDs, and organize observations by report section rather than by retrieval order.",
    reporterInstructions:
      "Write a cohesive academic report with an explicit thesis or answer, sectioned analysis, evidence table, limitations, and references. Keep prose polished and connect evidence to the research question throughout.",
    reportTemplate:
      "Academic research report: answer a scoped research question with thesis-driven synthesis, methodology, structured evidence review, analysis, implications, limitations, and references.",
    requiredSections: [
      "Title",
      "Abstract or Executive Summary",
      "Introduction and Research Question",
      "Background",
      "Method or Investigation Approach",
      "Findings",
      "Analysis and Discussion",
      "Evidence Table",
      "Implications or Recommendations",
      "Limitations",
      "References",
    ],
    evidencePolicy: academicCitationPolicy,
    figureSuggestions: [
      "Conceptual framework diagram",
      "Evidence table or source matrix",
      "Comparison chart for methods, cases, or interventions",
      "Summary figure linking findings to implications",
    ],
    evaluationRubric: [
      ...defaultRubric,
      {
        name: "Argument coherence",
        description: "The report advances a clear thesis and ties every major section back to the research question.",
      },
    ],
  },
  "proposal-report": {
    id: "proposal-report",
    name: "Proposal Report",
    description:
      "Use for research proposals, thesis proposals, grant-style plans, and project proposals that need objectives, methods, feasibility, and expected contributions.",
    triggers: ["research proposal", "proposal", "thesis proposal", "grant proposal", "开题报告", "研究计划", "课题申请"],
    plannerInstructions:
      "Plan a proposal instead of a findings report. Define the problem, motivation, research gap, objectives, research questions or hypotheses, proposed method, data/resources, timeline, risks, ethics when relevant, and expected contributions.",
    researcherInstructions:
      "Gather evidence that justifies the proposal: background literature, gap evidence, methodological precedents, datasets or resources, feasibility constraints, and risks. Focus on why the proposed work is needed and viable.",
    reporterInstructions:
      "Write a proposal-style report with clear aims, significance, literature gap, methodology, work plan, feasibility, risks, expected contributions, and evaluation plan. Avoid presenting proposed work as completed findings.",
    reportTemplate:
      "Research proposal: motivate an unmet problem, establish a literature gap, define objectives and questions, propose a method and work plan, assess feasibility and risks, and state expected contributions.",
    requiredSections: [
      "Title",
      "Abstract or Project Summary",
      "Background and Significance",
      "Problem Statement and Research Gap",
      "Objectives and Research Questions",
      "Proposed Methodology",
      "Data, Materials, or Resources",
      "Work Plan and Timeline",
      "Feasibility, Risks, and Ethics",
      "Expected Contributions",
      "Evaluation Plan",
      "References",
    ],
    evidencePolicy: {
      ...academicCitationPolicy,
      minimumSourceCount: 5,
      preferredSourceTypes: ["recent academic papers", "methodological papers", "datasets", "official reports", "uploaded project materials"],
      rules: [
        ...academicCitationPolicy.rules,
        "Use evidence primarily to justify the research gap, feasibility, and methodological choices.",
        "Mark proposed activities, expected outcomes, and assumptions as future work rather than completed findings.",
      ],
    },
    figureSuggestions: [
      "Conceptual framework or theory of change",
      "Gantt-style timeline",
      "Method workflow diagram",
      "Risk mitigation matrix",
    ],
    evaluationRubric: [
      ...defaultRubric,
      {
        name: "Proposal feasibility",
        description: "Objectives, methods, data, timeline, and risks form a realistic plan for the proposed work.",
      },
    ],
  },
};

export const allSkills = Object.values(skillRegistry);

export function getSkill(id: SkillId): SkillDefinition {
  return skillRegistry[id];
}

export function getSkills(ids: readonly SkillId[]): SkillDefinition[] {
  return ids.map((id) => skillRegistry[id]).filter(Boolean);
}
