export async function academicSearch(params) {
    const limit = Math.max(1, Math.min(10, params.maxResults));
    const [arxivResults, openAlexResults] = await Promise.allSettled([
        searchArxiv({ ...params, maxResults: Math.ceil(limit / 2) }),
        searchOpenAlex({ ...params, maxResults: Math.ceil(limit / 2) }),
    ]);
    const combined = [
        ...(openAlexResults.status === "fulfilled" ? openAlexResults.value : []),
        ...(arxivResults.status === "fulfilled" ? arxivResults.value : []),
    ];
    const seen = new Set();
    const deduped = [];
    for (const result of combined) {
        const key = normalizeKey(result.doi ?? result.title);
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        deduped.push(result);
    }
    return deduped.slice(0, limit);
}
async function searchArxiv(params) {
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", `all:${params.query}`);
    url.searchParams.set("start", "0");
    url.searchParams.set("max_results", String(Math.max(1, Math.min(10, params.maxResults))));
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");
    const res = await fetch(url, { ...(params.signal ? { signal: params.signal } : {}) });
    if (!res.ok)
        throw new Error(`arxiv HTTP ${res.status}: ${res.statusText}`);
    const xml = await res.text();
    return splitXmlEntries(xml).map((entry) => {
        const title = cleanText(readXmlTag(entry, "title") ?? "Untitled arXiv paper");
        const published = cleanText(readXmlTag(entry, "published") ?? "");
        const year = readYear(published);
        const id = cleanText(readXmlTag(entry, "id") ?? "");
        const authors = readArxivAuthors(entry);
        const summary = cleanText(readXmlTag(entry, "summary") ?? "");
        const doi = cleanText(readXmlTag(entry, "arxiv:doi") ?? "") || undefined;
        return {
            title,
            url: id || `https://arxiv.org/search/?query=${encodeURIComponent(title)}&searchtype=all`,
            source: "arxiv",
            authors,
            ...(year ? { year } : {}),
            ...(published ? { published } : {}),
            ...(summary ? { summary } : {}),
            ...(doi ? { doi } : {}),
        };
    });
}
async function searchOpenAlex(params) {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", params.query);
    url.searchParams.set("per-page", String(Math.max(1, Math.min(10, params.maxResults))));
    const res = await fetch(url, { ...(params.signal ? { signal: params.signal } : {}) });
    if (!res.ok)
        throw new Error(`openalex HTTP ${res.status}: ${res.statusText}`);
    const json = (await res.json().catch(() => null));
    if (!json || typeof json !== "object")
        return [];
    const results = json.results;
    if (!Array.isArray(results))
        return [];
    const out = [];
    for (const item of results) {
        if (!item || typeof item !== "object")
            continue;
        const raw = item;
        const title = asString(raw.title) ?? asString(raw.display_name);
        if (!title)
            continue;
        const doi = asString(raw.doi)?.replace(/^https?:\/\/doi\.org\//i, "");
        const landingPage = readOpenAlexUrl(raw) ?? asString(raw.id) ?? `https://openalex.org/works?search=${encodeURIComponent(title)}`;
        const year = typeof raw.publication_year === "number" ? raw.publication_year : undefined;
        const published = asString(raw.publication_date);
        const citationCount = typeof raw.cited_by_count === "number" ? raw.cited_by_count : undefined;
        const authors = readOpenAlexAuthors(raw.authorships);
        const concepts = readOpenAlexConcepts(raw.concepts);
        out.push({
            title,
            url: landingPage,
            source: "openalex",
            authors,
            ...(year ? { year } : {}),
            ...(published ? { published } : {}),
            ...(doi ? { doi } : {}),
            ...(citationCount != null ? { citationCount } : {}),
            ...(concepts.length ? { concepts } : {}),
        });
    }
    return out;
}
export function formatAcademicResults(results) {
    if (!results.length)
        return "(no academic search results)";
    return results
        .map((r, i) => {
        const meta = [
            r.source,
            r.year ? String(r.year) : null,
            r.citationCount != null ? `${r.citationCount} citations` : null,
            r.doi ? `DOI: ${r.doi}` : null,
        ].filter(Boolean);
        const authors = r.authors.length ? `\n  Authors: ${r.authors.slice(0, 6).join(", ")}` : "";
        const concepts = r.concepts?.length ? `\n  Concepts: ${r.concepts.slice(0, 6).join(", ")}` : "";
        const summary = r.summary ? `\n  Summary: ${r.summary}` : "";
        return `- [${i + 1}] ${r.title} (${r.url})\n  ${meta.join(" · ")}${authors}${concepts}${summary}`;
    })
        .join("\n");
}
export function academicResultsToToolResult(results) {
    return JSON.stringify(results.map((r) => ({
        type: "page",
        title: `${r.title}${r.year ? ` (${r.year})` : ""}`,
        url: r.url,
        content: [
            r.source,
            r.authors.length ? `Authors: ${r.authors.slice(0, 6).join(", ")}` : null,
            r.citationCount != null ? `Citations: ${r.citationCount}` : null,
            r.concepts?.length ? `Concepts: ${r.concepts.slice(0, 6).join(", ")}` : null,
            r.summary,
        ]
            .filter(Boolean)
            .join("\n"),
    })));
}
function splitXmlEntries(xml) {
    return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g), (match) => match[1] ?? "");
}
function readXmlTag(xml, tag) {
    const escaped = tag.replaceAll(":", "\\:");
    const match = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`).exec(xml);
    return match?.[1] ? decodeXml(match[1]) : null;
}
function readArxivAuthors(entry) {
    return Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g), (match) => cleanText(decodeXml(match[1] ?? ""))).filter(Boolean);
}
function readOpenAlexAuthors(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => {
        if (!item || typeof item !== "object")
            return null;
        const author = item.author;
        if (!author || typeof author !== "object")
            return null;
        return asString(author.display_name);
    })
        .filter((name) => Boolean(name));
}
function readOpenAlexConcepts(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => {
        if (!item || typeof item !== "object")
            return null;
        return asString(item.display_name);
    })
        .filter((name) => Boolean(name))
        .slice(0, 8);
}
function readOpenAlexUrl(raw) {
    const primaryLocation = raw.primary_location;
    if (primaryLocation && typeof primaryLocation === "object") {
        const landingPage = asString(primaryLocation.landing_page_url);
        const pdf = asString(primaryLocation.pdf_url);
        if (landingPage)
            return landingPage;
        if (pdf)
            return pdf;
    }
    return asString(raw.doi) ?? undefined;
}
function readYear(value) {
    const match = /^(\d{4})/.exec(value);
    if (!match?.[1])
        return undefined;
    const year = Number(match[1]);
    return Number.isFinite(year) ? year : undefined;
}
function asString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function cleanText(value) {
    return value.replace(/\s+/g, " ").trim();
}
function decodeXml(value) {
    return value
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'");
}
function normalizeKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "").slice(0, 160);
}
