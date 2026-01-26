export type WebSearchResult = {
  title: string;
  url: string;
  content?: string;
};

export async function webSearch(params: {
  query: string;
  maxResults: number;
  signal?: AbortSignal;
}): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const url = "https://api.tavily.com/search";
  const body = {
    api_key: apiKey,
    query: params.query,
    max_results: Math.max(1, Math.min(10, params.maxResults)),
    include_answer: false,
    include_raw_content: false,
    include_images: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...(params.signal ? { signal: params.signal } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`web_search HTTP ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`);
  }

  const json = (await res.json().catch(() => null)) as unknown;
  if (!json || typeof json !== "object") return [];
  const results = (json as Record<string, unknown>).results;
  if (!Array.isArray(results)) return [];

  const out: WebSearchResult[] = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const rr = r as Record<string, unknown>;
    const title = typeof rr.title === "string" ? rr.title : undefined;
    const url2 = typeof rr.url === "string" ? rr.url : undefined;
    const content = typeof rr.content === "string" ? rr.content : undefined;
    if (!title || !url2) continue;
    out.push({ title, url: url2, ...(content ? { content } : {}) });
  }
  return out;
}
