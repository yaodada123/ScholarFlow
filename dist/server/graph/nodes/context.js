import { emitGraphEvent } from "../trace-bridge.js";
export function createNodeEmitter(ctx) {
    return (config, event) => {
        const currentSpanId = ctx.getCurrentSpan();
        emitGraphEvent({
            ...(config ? { config } : {}),
            event,
            ...(ctx.trace ? { trace: ctx.trace } : {}),
            ...(currentSpanId ? { currentSpanId } : {}),
        });
    };
}
