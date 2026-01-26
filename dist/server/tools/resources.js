function normalize(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}
export function retrieveResources(params) {
    const q = normalize(params.query);
    const scored = params.resources
        .map((r) => {
        const hay = normalize(`${r.title ?? ""} ${r.description ?? ""} ${r.uri ?? ""}`);
        const score = q && hay.includes(q) ? 1 : 0;
        return { r, score };
    })
        .filter((x) => x.score > 0)
        .slice(0, Math.max(0, params.limit));
    if (scored.length > 0) {
        return scored.map(({ r, score }) => ({
            title: r.title ?? r.uri,
            uri: r.uri,
            ...(r.description ? { description: r.description } : {}),
            score,
        }));
    }
    return params.resources.slice(0, Math.max(0, params.limit)).map((r, idx) => ({
        title: r.title ?? r.uri,
        uri: r.uri,
        ...(r.description ? { description: r.description } : {}),
        score: 0.01 * (params.limit - idx),
    }));
}
