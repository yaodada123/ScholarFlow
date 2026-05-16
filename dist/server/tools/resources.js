import path from "node:path";
import { loadRagConfig, isLanceDbEnabled } from "../rag/config.js";
import { extractTextFromRagFile, localFilenameFromUri, ragDir } from "../rag/document-text.js";
import { searchIndexedResources } from "../rag/lancedb-store.js";
function normalize(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}
async function tryReadLocalExcerpt(params) {
    const filename = localFilenameFromUri(params.uri);
    if (!filename)
        return null;
    const filePath = path.join(ragDir, filename);
    try {
        const { text } = await extractTextFromRagFile(filePath, filename);
        const clipped = text.length > params.maxChars ? `${text.slice(0, params.maxChars)}\n…` : text;
        return clipped.trim() ? clipped : null;
    }
    catch {
        return null;
    }
}
async function retrieveResourcesLocalFallback(params) {
    const q = normalize(params.query);
    const scored = params.resources
        .map((r) => {
        const hay = normalize(`${r.title ?? ""} ${r.description ?? ""} ${r.uri ?? ""}`);
        const score = q && hay.includes(q) ? 1 : 0;
        return { r, score };
    })
        .filter((x) => x.score > 0)
        .slice(0, Math.max(0, params.limit));
    const chosen = scored.length > 0
        ? scored
        : params.resources.slice(0, Math.max(0, params.limit)).map((r, idx) => ({
            r,
            score: 0.01 * (params.limit - idx),
        }));
    return await Promise.all(chosen.map(async ({ r, score }) => {
        const excerpt = params.maxExcerptChars > 0 ? await tryReadLocalExcerpt({ uri: r.uri, maxChars: params.maxExcerptChars }) : null;
        return {
            title: r.title ?? r.uri,
            uri: r.uri,
            ...(r.description ? { description: r.description } : {}),
            ...(excerpt ? { excerpt } : {}),
            score,
        };
    }));
}
export async function retrieveResources(params) {
    const ragConfig = loadRagConfig();
    const maxExcerptChars = Math.max(0, Math.min(200_000, params.maxExcerptChars ?? ragConfig.maxContextChars));
    const fallbackParams = { ...params, maxExcerptChars };
    if (isLanceDbEnabled() && params.resources.length > 0) {
        try {
            const vectorResults = await searchIndexedResources({
                query: params.query,
                resources: params.resources,
                limit: params.limit,
                maxExcerptChars,
            });
            if (vectorResults.length > 0)
                return vectorResults;
        }
        catch (e) {
            console.warn("[rag] LanceDB retrieval failed; falling back to local excerpts", e);
        }
    }
    return await retrieveResourcesLocalFallback(fallbackParams);
}
