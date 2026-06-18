import { getSkills } from "./registry.js";
const reviewPaperPatterns = [
    /review\s+(this\s+)?(paper|article|study|preprint)/i,
    /peer\s+review/i,
    /critique\s+(this\s+)?(paper|article|study|preprint)/i,
    /analy[sz]e\s+(this\s+)?(paper|article|study|preprint)/i,
    /arxiv\.org\/abs\//i,
    /doi\.org\//i,
    /论文评审|审稿|评审这篇|分析这篇论文|评价这篇论文/,
];
const literatureReviewPatterns = [
    /systematic\s+(literature\s+)?review/i,
    /literature\s+(review|survey)/i,
    /survey\s+(of|on|about)?/i,
    /annotated\s+bibliography/i,
    /review\s+the\s+literature/i,
    /文献综述|系统综述|系统性综述|综述|文献调研/,
];
const deepResearchPatterns = [
    /\b(research|investigate|compare|explain|analy[sz]e|study)\b/i,
    /\bwhat\s+is\b/i,
    /\bhow\s+(does|do|can|to)\b/i,
    /调研|研究一下|研究|对比|比较|解释|分析|了解/,
];
const researchReportPatterns = [
    /\b(research|academic)\s+report\b/i,
    /\b(write|draft|generate|create)\s+(a\s+)?(full\s+)?report\b/i,
    /\bfull\s+(research|academic)\s+report\b/i,
    /研究报告|调研报告|学术报告|完整报告/,
];
const proposalReportPatterns = [
    /\b(research|thesis|grant|project)\s+proposal\b/i,
    /\bproposal\s+(report|draft|plan)\b/i,
    /\bpropose\s+(a\s+)?(study|project|research)\b/i,
    /开题报告|研究计划|课题申请|研究方案|项目申请/,
];
function matchesAny(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
}
function hasSinglePaperSignal(text, resources) {
    if (matchesAny(text, reviewPaperPatterns))
        return true;
    const paperLikeResources = resources.filter((resource) => /\.pdf($|[?#])|arxiv|doi|paper|论文/i.test(`${resource.uri} ${resource.title}`));
    return paperLikeResources.length === 1 && /review|critique|analy[sz]e|summari[sz]e|评审|审稿|分析|总结/.test(text);
}
export function selectSkills(params) {
    const query = params.query.trim();
    const resources = params.resources ?? [];
    const normalized = query.toLowerCase();
    const selected = [];
    const reasons = [];
    if (hasSinglePaperSignal(normalized, resources)) {
        selected.push("academic-paper-review");
        reasons.push("single-paper review signal detected");
    }
    if (!selected.includes("academic-paper-review") && matchesAny(query, literatureReviewPatterns)) {
        selected.push("systematic-literature-review");
        reasons.push("literature review or survey signal detected");
    }
    if (matchesAny(query, proposalReportPatterns)) {
        selected.push("proposal-report");
        reasons.push("research proposal signal detected");
    }
    if (!selected.includes("proposal-report") && matchesAny(query, researchReportPatterns)) {
        selected.push("research-report");
        reasons.push("complete research report signal detected");
    }
    if (selected.length === 0 && matchesAny(query, deepResearchPatterns)) {
        selected.push("deep-research");
        reasons.push("general research or comparison signal detected");
    }
    return {
        activeSkills: getSkills(selected),
        reason: reasons.length ? reasons.join("; ") : "no academic skill matched",
    };
}
