export class OpenAICompatibleEmbeddingClient {
    apiKey;
    baseUrl;
    model;
    timeoutMs;
    dimensions;
    constructor(cfg) {
        this.apiKey = cfg.apiKey;
        this.baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
        this.model = cfg.model;
        this.timeoutMs = cfg.timeoutMs ?? 60_000;
        this.dimensions = cfg.dimensions;
    }
    async embedTexts(params) {
        if (params.texts.length === 0)
            return [];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const abortListener = () => controller.abort();
        params.signal?.addEventListener("abort", abortListener, { once: true });
        try {
            const headers = { "Content-Type": "application/json" };
            if (this.apiKey)
                headers.Authorization = `Bearer ${this.apiKey}`;
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
            const json = (await res.json());
            if (!Array.isArray(json.data))
                return [];
            return json.data
                .slice()
                .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
                .map((item) => {
                if (!Array.isArray(item.embedding) || !item.embedding.every((v) => typeof v === "number")) {
                    throw new Error("embedding response contained an invalid vector");
                }
                return item.embedding;
            });
        }
        finally {
            clearTimeout(timeout);
            params.signal?.removeEventListener("abort", abortListener);
        }
    }
    async embedQuery(params) {
        const [embedding] = await this.embedTexts({ texts: [params.text], ...(params.signal ? { signal: params.signal } : {}) });
        if (!embedding)
            throw new Error("embedding response did not contain a query vector");
        return embedding;
    }
}
