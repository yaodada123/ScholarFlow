export async function* streamResearchGraphEvents(params) {
    for await (const chunk of params.stream) {
        if (Array.isArray(chunk) && chunk.length === 2) {
            const [mode, payload] = chunk;
            if (mode === "custom")
                yield payload;
            if (mode === "values")
                params.onState(payload);
        }
    }
}
