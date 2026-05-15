function readPrefixedEnv(prefix) {
    const out = {};
    for (const [k, v] of Object.entries(process.env)) {
        if (!k.startsWith(prefix))
            continue;
        if (typeof v !== "string")
            continue;
        const key = k.slice(prefix.length).toLowerCase();
        out[key] = v;
    }
    return out;
}
function toNumber(value) {
    if (!value)
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
export function loadLlmConfig(type) {
    const prefix = `${type.toUpperCase()}_MODEL__`;
    const env = readPrefixedEnv(prefix);
    const model = env.model;
    if (!model)
        return null;
    const apiKey = env.api_key;
    const baseUrl = env.base_url ?? env.api_base;
    const temperature = toNumber(env.temperature);
    const maxTokens = toNumber(env.max_tokens);
    const timeoutMs = toNumber(env.timeout ?? env.timeout_ms);
    return {
        model,
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(temperature != null ? { temperature } : {}),
        ...(maxTokens != null ? { maxTokens } : {}),
        ...(timeoutMs != null ? { timeoutMs } : {}),
    };
}
export function loadEmbeddingConfig() {
    const env = readPrefixedEnv("EMBEDDING_MODEL__");
    const model = env.model;
    if (!model)
        return null;
    const apiKey = env.api_key;
    const baseUrl = env.base_url ?? env.api_base;
    const timeoutMs = toNumber(env.timeout ?? env.timeout_ms);
    const batchSize = toNumber(env.batch_size);
    const dimensions = toNumber(env.dimensions);
    return {
        model,
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(timeoutMs != null ? { timeoutMs } : {}),
        ...(batchSize != null ? { batchSize } : {}),
        ...(dimensions != null ? { dimensions } : {}),
    };
}
export function getConfiguredModels() {
    const result = {};
    const types = ["basic", "reasoning", "vision", "code"];
    for (const t of types) {
        const cfg = loadLlmConfig(t);
        if (cfg?.model) {
            result[t] = [cfg.model];
        }
    }
    return result;
}
