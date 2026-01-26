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
      title: "Clarify scope & success criteria",
      description: query ? `Define success for: ${query}` : "Define success criteria.",
      tools: [],
    });
  }
  if (maxSteps >= 2) {
    steps.push({
      title: "Collect key sources",
      description: enableWebSearch
        ? "Search primary sources and reputable references."
        : "Use provided resources and general knowledge.",
      tools: enableWebSearch ? ["web_search"] : [],
    });
  }
  if (maxSteps >= 3) {
    steps.push({
      title: "Synthesize findings",
      description: "Extract key points, resolve conflicts, and form conclusions.",
      tools: [],
    });
  }
  if (maxSteps >= 4) {
    steps.push({
      title: "Draft report",
      description: "Write a structured report with concise sections and citations if available.",
      tools: [],
    });
  }

  return {
    title: query ? `Research plan: ${query}` : "Research plan",
    thought:
      "I will scope the task, gather sources (optionally via web search), synthesize findings, and write a clear report.",
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

  const system = "You are DeerFlow Planner. Output ONLY valid JSON (no markdown, no commentary).";

  const background = backgroundInvestigationResults
    ? `\n\nBackground investigation results:\n${backgroundInvestigationResults}`
    : "";

  const user =
    `Locale: ${locale}\n` +
    "Task: Create a research plan for the user query.\n" +
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

  const system = "You are DeerFlow Planner. Output ONLY valid JSON (no markdown, no commentary).";

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
    "You are DeerFlow Reporter. Write a high-quality markdown report. Include citations when sources are provided.";

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
    "Return markdown only.";

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
