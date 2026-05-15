const expectedSections = [
    "overview",
    "key_findings",
    "evidence",
    "discussion",
    "limitations",
    "references",
];
export function evaluateReportDeterministic(content) {
    const headings = Array.from(content.matchAll(/^#{1,6}\s+(.+)$/gm), (match) => match[1]?.trim() ?? "").filter(Boolean);
    const normalizedHeadings = headings.map(normalizeHeading);
    const sectionsFound = expectedSections.filter((section) => normalizedHeadings.some((heading) => matchesSection(heading, section)));
    const sectionsMissing = expectedSections.filter((section) => !sectionsFound.includes(section));
    const citationMatches = content.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)|\[(\d+)\]|https?:\/\/\S+|doi:\s*\S+/gi) ?? [];
    const urls = new Set(Array.from(content.matchAll(/https?:\/\/[^\s)\]]+/g), (match) => match[0].replace(/[.,;:]+$/, "")));
    const imageCount = (content.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length;
    const wordCount = countWords(content);
    const hasTitle = /^#\s+.+$/m.test(content);
    const hasKeyPoints = normalizedHeadings.some((heading) => matchesSection(heading, "key_findings"));
    const hasOverview = normalizedHeadings.some((heading) => matchesSection(heading, "overview"));
    const hasCitationsSection = normalizedHeadings.some((heading) => matchesSection(heading, "references"));
    const sectionCoverageScore = Math.round((sectionsFound.length / expectedSections.length) * 100) / 100;
    const metrics = {
        word_count: wordCount,
        citation_count: citationMatches.length,
        unique_sources: urls.size,
        image_count: imageCount,
        section_count: headings.length,
        section_coverage_score: sectionCoverageScore,
        sections_found: sectionsFound,
        sections_missing: sectionsMissing,
        has_title: hasTitle,
        has_key_points: hasKeyPoints,
        has_overview: hasOverview,
        has_citations_section: hasCitationsSection,
    };
    const score = computeScore(metrics);
    return {
        metrics,
        score,
        grade: gradeScore(score),
        summary: buildSummary(metrics, score),
    };
}
export function parseLlmEvaluation(text) {
    const parsed = parseJsonObject(text) ?? parseJsonObject(extractFirstJsonObject(text) ?? "");
    if (!parsed)
        return null;
    const scoresRaw = parsed.scores;
    if (!scoresRaw || typeof scoresRaw !== "object")
        return null;
    const scores = scoresRaw;
    const out = {
        scores: {
            factual_accuracy: readScore(scores.factual_accuracy),
            completeness: readScore(scores.completeness),
            coherence: readScore(scores.coherence),
            relevance: readScore(scores.relevance),
            citation_quality: readScore(scores.citation_quality),
            writing_quality: readScore(scores.writing_quality),
        },
        overall_score: readScore(parsed.overall_score),
        weighted_score: readScore(parsed.weighted_score),
        strengths: readStringArray(parsed.strengths),
        weaknesses: readStringArray(parsed.weaknesses),
        suggestions: readStringArray(parsed.suggestions),
    };
    return out;
}
function countWords(content) {
    const latinWords = content.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? [];
    const cjkChars = content.match(/[一-鿿]/g) ?? [];
    return latinWords.length + cjkChars.length;
}
function normalizeHeading(value) {
    return value.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, " ").trim();
}
function matchesSection(heading, section) {
    const terms = {
        overview: ["overview", "summary", "abstract", "概述", "摘要", "背景"],
        key_findings: ["key findings", "findings", "key points", "关键发现", "要点", "核心发现"],
        evidence: ["evidence", "literature", "review", "证据", "文献", "调研"],
        discussion: ["discussion", "analysis", "分析", "讨论"],
        limitations: ["limitations", "risk", "局限", "限制", "风险"],
        references: ["references", "citations", "further reading", "参考", "引用", "文献"],
    };
    return (terms[section] ?? []).some((term) => heading.includes(term));
}
function computeScore(metrics) {
    const lengthScore = Math.min(metrics.word_count / 900, 1) * 2;
    const sectionScore = metrics.section_coverage_score * 2.5;
    const citationScore = Math.min(metrics.citation_count / 6, 1) * 1.5;
    const sourceScore = Math.min(metrics.unique_sources / 4, 1) * 1.2;
    const structureScore = (metrics.has_title ? 0.8 : 0) +
        (metrics.has_overview ? 0.7 : 0) +
        (metrics.has_key_points ? 0.6 : 0) +
        (metrics.has_citations_section ? 0.7 : 0);
    return Math.round(Math.min(10, lengthScore + sectionScore + citationScore + sourceScore + structureScore) * 10) / 10;
}
function gradeScore(score) {
    if (score >= 9.5)
        return "A+";
    if (score >= 9)
        return "A";
    if (score >= 8)
        return "A-";
    if (score >= 7.5)
        return "B+";
    if (score >= 7)
        return "B";
    if (score >= 6.5)
        return "B-";
    if (score >= 6)
        return "C+";
    if (score >= 5)
        return "C";
    if (score >= 4)
        return "D";
    return "F";
}
function buildSummary(metrics, score) {
    const missing = metrics.sections_missing.length ? ` Missing sections: ${metrics.sections_missing.join(", ")}.` : "";
    return `Automated score ${score}/10 based on length, structure, citations, source diversity, and section coverage.${missing}`;
}
function parseJsonObject(text) {
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
function extractFirstJsonObject(text) {
    const start = text.indexOf("{");
    if (start < 0)
        return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === "{")
            depth++;
        if (ch === "}")
            depth--;
        if (depth === 0)
            return text.slice(start, i + 1);
    }
    return null;
}
function readScore(value) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n))
        return 0;
    return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}
function readStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === "string" && item.trim().length > 0);
}
