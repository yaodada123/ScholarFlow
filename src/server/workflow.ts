export type PlanStep = {
  title: string;
  description: string;
  tools?: string[];
};

export type Plan = {
  title: string;
  thought: string;
  steps: PlanStep[];
};

export type ReportStyle =
  | "academic"
  | "popular_science"
  | "news"
  | "social_media"
  | "strategic_investment";

export function buildFallbackPlan(params: {
  query: string;
  maxSteps: number;
  enableWebSearch: boolean;
}): Plan {
  const { query, maxSteps, enableWebSearch } = params;
  const steps: PlanStep[] = [];

  if (maxSteps >= 1) {
    steps.push({
      title: "Clarify the research question",
      description: query
        ? `Define the academic scope, key concepts, and expected outcome for: ${query}`
        : "Define the academic scope, key concepts, and expected outcome.",
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
      title: "Synthesize findings and limitations",
      description: "Extract key findings, compare perspectives, identify limitations, and form evidence-based conclusions.",
      tools: [],
    });
  }
  if (maxSteps >= 4) {
    steps.push({
      title: "Draft academic research report",
      description: "Write a structured report with research question, evidence, discussion, limitations, and citations if available.",
      tools: [],
    });
  }

  return {
    title: query ? `Academic research plan: ${query}` : "Academic research plan",
    thought:
      "I will clarify the research question, gather academic evidence, synthesize findings and limitations, and write a structured research report.",
    steps,
  };
}

export function buildPlannerPrompt(params: {
  query: string;
  locale: string;
  maxSteps: number;
  enableWebSearch: boolean;
  backgroundInvestigationResults?: string | null;
}): { system: string; user: string } {
  const { query, locale, maxSteps, enableWebSearch, backgroundInvestigationResults } = params;

  const system =
    "You are ScholarFlow Planner, an academic research planning agent. Output ONLY valid JSON (no markdown, no commentary).";

  const background = backgroundInvestigationResults
    ? `\n\nBackground investigation results:\n${backgroundInvestigationResults}`
    : "";

  const user =
    `Locale: ${locale}\n` +
    "Task: Create an academic research plan for the user query.\n" +
    `Constraints: max_step_num=${maxSteps}, enable_web_search=${enableWebSearch}\n` +
    "JSON schema:\n" +
    "{\n" +
    '  "title": string,\n' +
    '  "thought": string,\n' +
    '  "steps": [\n' +
    '    { "title": string, "description": string, "tools"?: string[] }\n' +
    "  ]\n" +
    "}\n" +
    `User query: ${query}${background}`;

  return { system, user };
}

export function buildPlannerEditPrompt(params: {
  locale: string;
  query: string;
  currentPlan: Plan;
  instruction: string;
  maxSteps: number;
  enableWebSearch: boolean;
  backgroundInvestigationResults?: string | null;
}): { system: string; user: string } {
  const {
    locale,
    query,
    currentPlan,
    instruction,
    maxSteps,
    enableWebSearch,
    backgroundInvestigationResults,
  } = params;

  const system =
    "You are ScholarFlow Planner, an academic research planning agent. Output ONLY valid JSON (no markdown, no commentary).";

  const background = backgroundInvestigationResults
    ? `\n\nBackground investigation results:\n${backgroundInvestigationResults}`
    : "";

  const user =
    `Locale: ${locale}\n` +
    `User query: ${query}\n` +
    `Constraints: max_step_num=${maxSteps}, enable_web_search=${enableWebSearch}\n` +
    "You MUST revise the plan based on the user instruction.\n\n" +
    `Current plan (JSON):\n${JSON.stringify(currentPlan, null, 2)}\n\n` +
    `User instruction:\n${instruction}${background}\n\n` +
    "Output the revised plan JSON only.";

  return { system, user };
}

export function buildReporterPrompt(params: {
  query: string;
  locale: string;
  style: ReportStyle | undefined;
  plan: Plan;
  observations: string[];
  sources: Array<{ title: string; uri: string }>;
}): { system: string; user: string } {
  const { query, locale, style, plan, observations, sources } = params;

  const system =
    "You are ScholarFlow Reporter, an academic research writing agent. Write a high-quality markdown research report. " +
    "Ground claims in the provided observations and sources, include citations when sources are provided, and explicitly note limitations when evidence is incomplete.";

  const sourcesText = sources.length
    ? sources.map((s, i) => `- [${i + 1}] ${s.title} (${s.uri})`).join("\n")
    : "(none)";

  const user =
    `Locale: ${locale}\n` +
    `Report style: ${style ?? "default"}\n` +
    `User query: ${query}\n\n` +
    `Plan (JSON):\n${JSON.stringify(plan, null, 2)}\n\n` +
    `Observations:\n${observations.length ? observations.join("\n\n") : "(none)"}\n\n` +
    `Sources:\n${sourcesText}\n\n` +
    "Return markdown only. Prefer sections such as Research Question, Key Findings, Evidence, Discussion, Limitations, and Further Reading when appropriate.";

  return { system, user };
}

export function safeParsePlan(text: string): Plan | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const direct = tryParseJsonObject(trimmed);
  if (direct) {
    const validated = validatePlanShape(direct);
    if (validated) return validated;
  }

  const extracted = extractFirstJsonObject(trimmed);
  if (extracted) {
    const parsed = tryParseJsonObject(extracted);
    if (parsed) {
      const validated = validatePlanShape(parsed);
      if (validated) return validated;
    }
  }

  return null;
}

function tryParseJsonObject(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }

  return null;
}

function validatePlanShape(value: unknown): Plan | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== "string") return null;
  if (typeof v.thought !== "string") return null;
  if (!Array.isArray(v.steps)) return null;

  const steps: PlanStep[] = [];
  for (const s of v.steps) {
    if (!s || typeof s !== "object") return null;
    const step = s as Record<string, unknown>;
    if (typeof step.title !== "string") return null;
    if (typeof step.description !== "string") return null;
    const toolsRaw = step.tools;
    const tools =
      Array.isArray(toolsRaw) && toolsRaw.every((t) => typeof t === "string")
        ? (toolsRaw as string[])
        : undefined;
    steps.push({
      title: step.title,
      description: step.description,
      ...(tools ? { tools } : {}),
    });
  }

  return { title: v.title, thought: v.thought, steps };
}
