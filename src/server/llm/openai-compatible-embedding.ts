export type EmbeddingConfig = {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  batchSize?: number;
  dimensions?: number;
};

export type EmbeddingRequest = {
  texts: string[];
  signal?: AbortSignal;
};

type EmbeddingResponse = {
  data?: Array<{
    index?: number;
    embedding?: unknown;
  }>;
};

export class OpenAICompatibleEmbeddingClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly dimensions: number | undefined;

  constructor(cfg: EmbeddingConfig) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = cfg.model;
    this.timeoutMs = cfg.timeoutMs ?? 60_000;
    this.dimensions = cfg.dimensions;
  }

  async embedTexts(params: EmbeddingRequest): Promise<number[][]> {
    if (params.texts.length === 0) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortListener = () => controller.abort();
    params.signal?.addEventListener("abort", abortListener, { once: true });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

      const body = {
        model: this.model,
        input: params.texts,
        ...(this.dimensions ? { dimensions: this.dimensions } : {}),
      };

      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`embedding HTTP ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`);
      }

      const json = (await res.json()) as EmbeddingResponse;
      if (!Array.isArray(json.data)) return [];

      return json.data
        .slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => {
          if (!Array.isArray(item.embedding) || !item.embedding.every((v) => typeof v === "number")) {
            throw new Error("embedding response contained an invalid vector");
          }
          return item.embedding;
        });
    } finally {
      clearTimeout(timeout);
      params.signal?.removeEventListener("abort", abortListener);
    }
  }

  async embedQuery(params: { text: string; signal?: AbortSignal }): Promise<number[]> {
    const [embedding] = await this.embedTexts({ texts: [params.text], ...(params.signal ? { signal: params.signal } : {}) });
    if (!embedding) throw new Error("embedding response did not contain a query vector");
    return embedding;
  }
}
