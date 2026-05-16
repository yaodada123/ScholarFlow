import { createHash } from "node:crypto";
import path from "node:path";
import { stat } from "node:fs/promises";

import * as lancedb from "@lancedb/lancedb";
import type { Connection, Table } from "@lancedb/lancedb";

import type { Resource } from "../schemas.js";
import { loadEmbeddingConfig } from "../llm/env-models.js";
import { OpenAICompatibleEmbeddingClient } from "../llm/openai-compatible-embedding.js";
import { chunkText } from "./chunk.js";
import { loadRagConfig } from "./config.js";
import { extractTextFromRagFile, isAllowedRagFilename, localFilenameFromUri, ragDir, sanitizeRagFilename } from "./document-text.js";

export type VectorSearchResult = {
  title: string;
  uri: string;
  description?: string;
  excerpt: string;
  score: number;
};

type RagChunkRow = {
  id: string;
  resource_uri: string;
  title: string;
  description: string;
  filename: string;
  chunk_index: number;
  text: string;
  vector: number[];
  content_hash: string;
  file_size: number;
  file_mtime_ms: number;
  indexed_at: string;
};

type LanceSearchRow = Partial<RagChunkRow> & {
  _distance?: number;
};

let connectionPromise: Promise<Connection> | null = null;
let tablePromise: Promise<Table | null> | null = null;

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function getEmbeddingClient(): { client: OpenAICompatibleEmbeddingClient; batchSize: number } | null {
  const cfg = loadEmbeddingConfig();
  if (!cfg) return null;
  return {
    client: new OpenAICompatibleEmbeddingClient(cfg),
    batchSize: Math.max(1, Math.min(256, Math.floor(cfg.batchSize ?? 64))),
  };
}

async function embedBatches(texts: string[]): Promise<number[][]> {
  const embedding = getEmbeddingClient();
  if (!embedding) throw new Error("Embedding model is not configured");

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += embedding.batchSize) {
    const batch = texts.slice(i, i + embedding.batchSize);
    out.push(...(await embedding.client.embedTexts({ texts: batch })));
  }
  if (out.length !== texts.length) throw new Error("Embedding response count did not match input count");
  return out;
}

async function embedQuery(text: string, signal?: AbortSignal): Promise<number[]> {
  const embedding = getEmbeddingClient();
  if (!embedding) throw new Error("Embedding model is not configured");
  return await embedding.client.embedQuery({ text, ...(signal ? { signal } : {}) });
}

async function getConnection(): Promise<Connection> {
  if (!connectionPromise) {
    const cfg = loadRagConfig();
    connectionPromise = lancedb.connect(path.resolve(process.cwd(), cfg.lanceDbUri));
  }
  return await connectionPromise;
}

async function tableExists(conn: Connection, tableName: string): Promise<boolean> {
  const names = await conn.tableNames();
  return names.includes(tableName);
}

async function openTableIfExists(): Promise<Table | null> {
  const cfg = loadRagConfig();
  const conn = await getConnection();
  if (!(await tableExists(conn, cfg.lanceDbTable))) return null;
  return await conn.openTable(cfg.lanceDbTable);
}

async function getExistingTable(): Promise<Table | null> {
  if (tablePromise) {
    const cached = await tablePromise;
    if (cached) return cached;
  }
  const table = await openTableIfExists();
  if (table) tablePromise = Promise.resolve(table);
  return table;
}

async function getOrCreateTable(rows: RagChunkRow[]): Promise<Table> {
  const cfg = loadRagConfig();
  const existing = await getExistingTable();
  if (existing) return existing;
  if (rows.length === 0) throw new Error("Cannot create LanceDB table without rows");

  const conn = await getConnection();
  const table = await conn.createTable(cfg.lanceDbTable, rows, { existOk: true });
  tablePromise = Promise.resolve(table);
  return table;
}

async function hasCurrentRows(params: { table: Table; resourceUri: string; contentHash: string }): Promise<boolean> {
  const count = await params.table.countRows(
    `resource_uri = ${sqlString(params.resourceUri)} AND content_hash = ${sqlString(params.contentHash)}`,
  );
  return count > 0;
}

export async function indexLocalResource(params: {
  filename: string;
  uri: string;
  title: string;
  description?: string;
  extractedText?: string;
}): Promise<void> {
  const filename = sanitizeRagFilename(params.filename);
  if (!isAllowedRagFilename(filename)) return;

  const filePath = path.join(ragDir, filename);
  const info = await stat(filePath);
  const text = (params.extractedText ?? (await extractTextFromRagFile(filePath, filename)).text).trim();
  if (!text) return;

  const cfg = loadRagConfig();
  const contentHash = hashText(text);
  const table = await getExistingTable();
  if (table && (await hasCurrentRows({ table, resourceUri: params.uri, contentHash }))) {
    await table
      .delete(`resource_uri = ${sqlString(params.uri)} AND content_hash != ${sqlString(contentHash)}`)
      .catch(() => undefined);
    return;
  }

  const chunks = chunkText({ text, chunkSize: cfg.chunkSize, chunkOverlap: cfg.chunkOverlap });
  if (chunks.length === 0) return;

  const embeddings = await embedBatches(chunks.map((chunk) => chunk.text));
  const indexedAt = new Date().toISOString();
  const rows: RagChunkRow[] = chunks.map((chunk, index) => ({
    id: `${params.uri}#${contentHash}#${chunk.index}`,
    resource_uri: params.uri,
    title: params.title,
    description: params.description ?? "",
    filename,
    chunk_index: chunk.index,
    text: chunk.text,
    vector: embeddings[index] ?? [],
    content_hash: contentHash,
    file_size: info.size,
    file_mtime_ms: info.mtimeMs,
    indexed_at: indexedAt,
  }));

  if (rows.some((row) => row.vector.length === 0)) throw new Error("Embedding response contained an empty vector");

  const target = await getOrCreateTable(rows);
  if (target !== table) return;

  await target.add(rows);
  await target
    .delete(`resource_uri = ${sqlString(params.uri)} AND content_hash != ${sqlString(contentHash)}`)
    .catch(() => undefined);
}

export async function ensureResourcesIndexed(params: { resources: Resource[] }): Promise<void> {
  for (const resource of params.resources) {
    const filename = localFilenameFromUri(resource.uri);
    if (!filename) continue;
    await indexLocalResource({
      filename,
      uri: resource.uri,
      title: resource.title ?? filename,
      description: resource.description,
    });
  }
}

function clipText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars))}\n…`;
}

function scoreFromDistance(distance: number | undefined): number {
  if (typeof distance !== "number" || !Number.isFinite(distance)) return 0;
  return 1 / (1 + Math.max(0, distance));
}

export async function searchIndexedResources(params: {
  query: string;
  resources: Resource[];
  limit: number;
  maxExcerptChars: number;
  signal?: AbortSignal;
}): Promise<VectorSearchResult[]> {
  const query = params.query.trim();
  if (!query || params.resources.length === 0 || params.limit <= 0 || params.maxExcerptChars <= 0) return [];

  await ensureResourcesIndexed({ resources: params.resources });
  const table = await getExistingTable();
  if (!table) return [];

  const selectedUris = params.resources.map((r) => r.uri);
  const allowedUris = new Set(selectedUris);
  const where = `resource_uri IN (${selectedUris.map(sqlString).join(", ")})`;
  const queryVector = await embedQuery(query, params.signal);
  const oversampleLimit = Math.max(params.limit * 20, params.limit, 20);
  const rows = (await table
    .vectorSearch(queryVector)
    .where(where)
    .limit(Math.min(100, oversampleLimit))
    .select(["resource_uri", "title", "description", "chunk_index", "text", "_distance"])
    .toArray()) as LanceSearchRow[];

  const grouped = new Map<
    string,
    {
      title: string;
      description: string;
      chunks: Array<{ text: string; chunkIndex: number; score: number }>;
      score: number;
    }
  >();

  for (const row of rows) {
    if (!row.resource_uri || !allowedUris.has(row.resource_uri) || !row.text) continue;
    const score = scoreFromDistance(row._distance);
    const existing = grouped.get(row.resource_uri);
    const chunk = { text: row.text, chunkIndex: row.chunk_index ?? 0, score };
    if (existing) {
      existing.chunks.push(chunk);
      existing.score = Math.max(existing.score, score);
      continue;
    }
    grouped.set(row.resource_uri, {
      title: row.title ?? row.resource_uri,
      description: row.description ?? "",
      chunks: [chunk],
      score,
    });
  }

  const maxResources = Math.max(1, Math.min(params.limit, grouped.size || params.limit));
  const maxPerResource = Math.max(1, Math.floor(params.maxExcerptChars / maxResources));

  return [...grouped.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, params.limit)
    .map(([uri, group]) => {
      const excerpt = clipText(
        group.chunks
          .sort((a, b) => b.score - a.score)
          .map((chunk) => `[chunk ${chunk.chunkIndex}]\n${chunk.text}`)
          .join("\n\n---\n\n"),
        maxPerResource,
      );
      return {
        title: group.title,
        uri,
        ...(group.description ? { description: group.description } : {}),
        excerpt,
        score: group.score,
      };
    });
}
