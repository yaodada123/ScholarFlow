export type RagProvider = "local" | "lancedb";

export type RagConfig = {
  provider: RagProvider;
  lanceDbUri: string;
  lanceDbTable: string;
  chunkSize: number;
  chunkOverlap: number;
  maxContextChars: number;
};

function toPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function loadRagConfig(): RagConfig {
  const provider = (process.env.RAG_PROVIDER ?? "").trim().toLowerCase() === "lancedb" ? "lancedb" : "local";
  const chunkSize = toPositiveInt(process.env.RAG_CHUNK_SIZE, 1200);
  const chunkOverlap = Math.min(toNonNegativeInt(process.env.RAG_CHUNK_OVERLAP, 200), Math.max(0, chunkSize - 1));

  return {
    provider,
    lanceDbUri: (process.env.LANCEDB_URI ?? "data/lancedb").trim() || "data/lancedb",
    lanceDbTable: (process.env.LANCEDB_TABLE ?? "rag_chunks").trim() || "rag_chunks",
    chunkSize,
    chunkOverlap,
    maxContextChars: toPositiveInt(process.env.RAG_MAX_CONTEXT_CHARS, 12_000),
  };
}

export function isLanceDbEnabled(): boolean {
  return loadRagConfig().provider === "lancedb";
}
