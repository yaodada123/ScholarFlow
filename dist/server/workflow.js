export function buildFallbackPlan(params) {
    const { query, maxSteps, enableWebSearch } = params;
    const topicTitle = query ? `Research topic direction: ${query}` : "Research topic direction";
    const topicCandidates = [
        {
            title: topicTitle,
            rationale: query
                ? `Use the user's interest in "${query}" as the anchor and narrow it into a feasible academic research direction.`
                : "Start from the user's broad interest and narrow it into a feasible academic research direction.",
            researchQuestions: [
                query ? `What core problem should be investigated within ${query}?` : "What core problem should the project investigate?",
                "What evidence is available to support or challenge the proposed direction?",
                "What boundaries and assumptions should define the final report?",
            ],
            keywords: query
                ? query
                    .split(/[\s,，;；、]+/)
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .slice(0, 6)
                : ["research direction", "literature review", "evidence synthesis"],
            feasibility: "Medium: feasible after narrowing the scope and confirming available evidence.",
            novelty: "To be assessed through retrieved papers, notes, and optional web search results.",
            evidencePlan: enableWebSearch
                ? "Combine selected local materials with reputable web or academic search results."
                : "Use selected local papers, notes, and uploaded research materials as the evidence base.",
        },
    ];
    const steps = [];
    if (maxSteps >= 1) {
        steps.push({
            title: "Generate and compare topic directions",
            description: "Propose candidate topic directions, then compare their rationale, feasibility, novelty, and evidence needs.",
            tools: [],
        });
    }
    if (maxSteps >= 2) {
        steps.push({
            title: "Collect academic evidence",
            description: enableWebSearch
                ? "Search provided materials and reputable web references for relevant evidence."
                : "Use provided papers, notes, and research materials as the evidence base.",
            tools: enableWebSearch ? ["web_search"] : [],
        });
    }
    if (maxSteps >= 3) {
        steps.push({
            title: "Evaluate topic fit and risks",
            description: "Assess each direction against evidence coverage, research value, feasibility, scope risk, and expected report quality.",
            tools: [],
        });
    }
    if (maxSteps >= 4) {
        steps.push({
            title: "Draft academic research report",
            description: "Write a structured report with recommended topic direction, research questions, evidence, discussion, limitations, and citations if available.",
            tools: [],
        });
    }
    return {
        title: query ? `Academic topic research plan: ${query}` : "Academic topic research plan",
        thought: "I will generate candidate topic directions, evaluate feasibility and novelty, gather evidence, and write a structured research report with a recommended direction.",
        topicCandidates,
        selectedTopic: topicCandidates[0].title,
        steps,
    };
}
export function buildPlannerPrompt(params) {
    const { query, locale, maxSteps, enableWebSearch, backgroundInvestigationResults } = params;
    const system = "You are ScholarFlow Planner, an academic research planning agent. Output ONLY valid JSON (no markdown, no commentary).";
    const background = backgroundInvestigationResults
        ? `\n\nBackground investigation results:\n${backgroundInvestigationResults}`
        : "";
    const user = `Locale: ${locale}\n` +
        "Task: Create an academic topic-direction research plan for the user query.\n" +
        "The plan must first propose 2-4 candidate research topic directions, then plan evidence collection and report writing.\n" +
        `Constraints: max_step_num=${maxSteps}, enable_web_search=${enableWebSearch}\n` +
        "JSON schema:\n" +
        "{\n" +
        '  "title": string,\n' +
        '  "thought": string,\n' +
        '  "topicCandidates": [\n' +
        '    { "title": string, "rationale": string, "researchQuestions": string[], "keywords": string[], "feasibility": string, "novelty": string, "evidencePlan": string }\n' +
        "  ],\n" +
        '  "selectedTopic": string,\n' +
        '  "steps": [\n' +
        '    { "title": string, "description": string, "tools"?: string[] }\n' +
        "  ]\n" +
        "}\n" +
        "Quality bar: candidates must be specific enough for a literature review, distinct from each other, and evaluated for feasibility, novelty, evidence availability, and scope risk.\n" +
        `User query: ${query}${background}`;
    return { system, user };
}
export function ensureTopicPlanFields(params) {
    const { plan, query, enableWebSearch } = params;
    if (plan.topicCandidates?.length && plan.selectedTopic)
        return plan;
    const fallback = buildFallbackPlan({
        query,
        maxSteps: Math.max(1, plan.steps.length),
        enableWebSearch,
    });
    const topicCandidates = plan.topicCandidates?.length ? plan.topicCandidates : fallback.topicCandidates;
    const selectedTopic = plan.selectedTopic ?? topicCandidates?.[0]?.title ?? fallback.selectedTopic;
    return {
        ...plan,
        ...(topicCandidates?.length ? { topicCandidates } : {}),
        ...(selectedTopic ? { selectedTopic } : {}),
    };
}
export function buildPlannerEditPrompt(params) {
    const { locale, query, currentPlan, instruction, maxSteps, enableWebSearch, backgroundInvestigationResults, } = params;
    const system = "You are ScholarFlow Planner, an academic research planning agent. Output ONLY valid JSON (no markdown, no commentary).";
    const background = backgroundInvestigationResults
        ? `\n\nBackground investigation results:\n${backgroundInvestigationResults}`
        : "";
    const user = `Locale: ${locale}\n` +
        `User query: ${query}\n` +
        `Constraints: max_step_num=${maxSteps}, enable_web_search=${enableWebSearch}\n` +
        "You MUST revise the topic-direction plan based on the user instruction while preserving the topicCandidates and selectedTopic fields.\n\n" +
        `Current plan (JSON):\n${JSON.stringify(currentPlan, null, 2)}\n\n` +
        `User instruction:\n${instruction}${background}\n\n` +
        "Output the revised plan JSON only.";
    return { system, user };
}
export function buildReporterPrompt(params) {
    const { query, locale, style, plan, observations, sources } = params;
    const system = "You are ScholarFlow Reporter, an academic research writing agent. Write a high-quality markdown research report. " +
        "Ground claims in the provided observations and sources, include citations when sources are provided, and explicitly note limitations when evidence is incomplete.";
    const sourcesText = sources.length
        ? sources.map((s, i) => `- [${i + 1}] ${s.title} (${s.uri})`).join("\n")
        : "(none)";
    const user = `Locale: ${locale}\n` +
        `Report style: ${style ?? "default"}\n` +
        `User query: ${query}\n\n` +
        `Plan (JSON):\n${JSON.stringify(plan, null, 2)}\n\n` +
        `Observations:\n${observations.length ? observations.join("\n\n") : "(none)"}\n\n` +
        `Sources:\n${sourcesText}\n\n` +
        "Return markdown only. The report must include: Recommended Topic Direction, Candidate Topic Comparison, Core Research Questions, Evidence Review, Feasibility and Novelty Assessment, Method or Investigation Plan, Limitations, and Further Reading when appropriate.";
    return { system, user };
}
export function safeParsePlan(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return null;
    const direct = tryParseJsonObject(trimmed);
    if (direct) {
        const validated = validatePlanShape(direct);
        if (validated)
            return validated;
    }
    const extracted = extractFirstJsonObject(trimmed);
    if (extracted) {
        const parsed = tryParseJsonObject(extracted);
        if (parsed) {
            const validated = validatePlanShape(parsed);
            if (validated)
                return validated;
        }
    }
    return null;
}
function tryParseJsonObject(text) {
    try {
        return JSON.parse(text);
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
function validatePlanShape(value) {
    if (!value || typeof value !== "object")
        return null;
    const v = value;
    if (typeof v.title !== "string")
        return null;
    if (typeof v.thought !== "string")
        return null;
    if (!Array.isArray(v.steps))
        return null;
    const topicCandidates = validateTopicCandidates(v.topicCandidates);
    const selectedTopic = typeof v.selectedTopic === "string" ? v.selectedTopic : undefined;
    const steps = [];
    for (const s of v.steps) {
        if (!s || typeof s !== "object")
            return null;
        const step = s;
        if (typeof step.title !== "string")
            return null;
        if (typeof step.description !== "string")
            return null;
        const toolsRaw = step.tools;
        const tools = Array.isArray(toolsRaw) && toolsRaw.every((t) => typeof t === "string")
            ? toolsRaw
            : undefined;
        steps.push({
            title: step.title,
            description: step.description,
            ...(tools ? { tools } : {}),
        });
    }
    return {
        title: v.title,
        thought: v.thought,
        ...(topicCandidates ? { topicCandidates } : {}),
        ...(selectedTopic ? { selectedTopic } : {}),
        steps,
    };
}
function validateTopicCandidates(value) {
    if (!Array.isArray(value))
        return undefined;
    const candidates = [];
    for (const item of value) {
        if (!item || typeof item !== "object")
            continue;
        const raw = item;
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        const rationale = typeof raw.rationale === "string" ? raw.rationale.trim() : "";
        const feasibility = typeof raw.feasibility === "string" ? raw.feasibility.trim() : "";
        const novelty = typeof raw.novelty === "string" ? raw.novelty.trim() : "";
        const evidencePlan = typeof raw.evidencePlan === "string" ? raw.evidencePlan.trim() : "";
        const researchQuestions = Array.isArray(raw.researchQuestions)
            ? raw.researchQuestions.filter((x) => typeof x === "string" && x.trim().length > 0)
            : [];
        const keywords = Array.isArray(raw.keywords)
            ? raw.keywords.filter((x) => typeof x === "string" && x.trim().length > 0)
            : [];
        if (!title || !rationale || !feasibility || !novelty || !evidencePlan)
            continue;
        candidates.push({
            title,
            rationale,
            researchQuestions,
            keywords,
            feasibility,
            novelty,
            evidencePlan,
        });
    }
    return candidates.length ? candidates : undefined;
}
