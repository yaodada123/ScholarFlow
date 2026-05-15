import path from "node:path";
import { readFile } from "node:fs/promises";
import { loadRagConfig, isLanceDbEnabled } from "../rag/config.js";
import { searchIndexedResources } from "../rag/lancedb-store.js";
const ragDir = path.resolve(process.cwd(), "data", "rag");
function normalize(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function sanitizeFilename(input) {
    const base = path.basename(input ?? "").replaceAll("\0", "");
    const cleaned = base.replaceAll(/[\\/]/g, "_").trim();
    if (!cleaned)
        return "upload.txt";
    return cleaned.slice(0, 200);
}
function isAllowedRagFilename(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ext === ".md" || ext === ".txt";
}
function localFilenameFromUri(uri) {
    if (!uri.startsWith("rag://local/"))
        return null;
    const raw = uri.slice("rag://local/".length);
    const decoded = (() => {
        try {
            return decodeURIComponent(raw);
        }
        catch {
            return raw;
        }
    })();
    const filename = sanitizeFilename(decoded);
    if (!isAllowedRagFilename(filename))
        return null;
    return filename;
}
async function tryReadLocalExcerpt(params) {
    const filename = localFilenameFromUri(params.uri);
    if (!filename)
        return null;
    const filePath = path.join(ragDir, filename);
    try {
        const content = await readFile(filePath, { encoding: "utf8" });
        const text = content.replace(/\r\n/g, "\n");
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
