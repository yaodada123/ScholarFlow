import path from "node:path";
import { readFile } from "node:fs/promises";

import type { Resource } from "../schemas.js";

export type RetrievedResource = {
  title: string;
  uri: string;
  description?: string;
  excerpt?: string;
  score: number;
};

const ragDir = path.resolve(process.cwd(), "data", "rag");

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeFilename(input: string): string {
  const base = path.basename(input ?? "").replaceAll("\0", "");
  const cleaned = base.replaceAll(/[\\/]/g, "_").trim();
  if (!cleaned) return "upload.txt";
  return cleaned.slice(0, 200);
}

function isAllowedRagFilename(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".md" || ext === ".txt";
}

function localFilenameFromUri(uri: string): string | null {
  if (!uri.startsWith("rag://local/")) return null;
  const raw = uri.slice("rag://local/".length);
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  const filename = sanitizeFilename(decoded);
  if (!isAllowedRagFilename(filename)) return null;
  return filename;
}

async function tryReadLocalExcerpt(params: { uri: string; maxChars: number }): Promise<string | null> {
  const filename = localFilenameFromUri(params.uri);
  if (!filename) return null;

  const filePath = path.join(ragDir, filename);
  try {
    const content = await readFile(filePath, { encoding: "utf8" });
    const text = content.replace(/\r\n/g, "\n");
    const clipped = text.length > params.maxChars ? `${text.slice(0, params.maxChars)}\n…` : text;
    return clipped.trim() ? clipped : null;
  } catch {
    return null;
  }
}

export async function retrieveResources(params: {
  query: string;
  resources: Resource[];
  limit: number;
  maxExcerptChars?: number;
}): Promise<RetrievedResource[]> {
  const q = normalize(params.query);
  const maxExcerptChars = Math.max(0, Math.min(200_000, params.maxExcerptChars ?? 12_000));
  const scored = params.resources
    .map((r) => {
      const hay = normalize(`${r.title ?? ""} ${r.description ?? ""} ${r.uri ?? ""}`);
      const score = q && hay.includes(q) ? 1 : 0;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .slice(0, Math.max(0, params.limit));

  const chosen: Array<{ r: Resource; score: number }> =
    scored.length > 0
      ? scored
      : params.resources.slice(0, Math.max(0, params.limit)).map((r, idx) => ({
          r,
          score: 0.01 * (params.limit - idx),
        }));

  return await Promise.all(
    chosen.map(async ({ r, score }) => {
      const excerpt =
        maxExcerptChars > 0 ? await tryReadLocalExcerpt({ uri: r.uri, maxChars: maxExcerptChars }) : null;
      return {
        title: r.title ?? r.uri,
        uri: r.uri,
        ...(r.description ? { description: r.description } : {}),
        ...(excerpt ? { excerpt } : {}),
        score,
      };
    }),
  );
}
