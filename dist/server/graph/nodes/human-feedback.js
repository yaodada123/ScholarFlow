import { randomUUID } from "node:crypto";
import { createNodeEmitter } from "./context.js";
import { tracedNode } from "./node-utils.js";
export function createHumanFeedbackNode(ctx) {
    const { trace } = ctx;
    const emit = createNodeEmitter(ctx);
    return async (s, config) => tracedNode(trace, {
        spanId: `span_human_feedback_${randomUUID()}`,
        name: "planning.human_feedback",
        agent: "planner",
        input: { plannerShouldInterrupt: s.plannerShouldInterrupt },
        currentSpan: ctx.getCurrentSpan(),
        setCurrentSpan: (spanId) => {
            ctx.setCurrentSpan(spanId);
        },
    }, async () => {
        if (!s.plannerShouldInterrupt)
            return {};
        const interruptId = `human_feedback:${randomUUID()}`;
        emit(config, {
            type: "interrupt",
            data: {
                thread_id: s.threadId,
                id: interruptId,
                agent: "planner",
                role: "assistant",
                finish_reason: "interrupt",
                options: [
                    { text: "Edit plan", value: "edit_plan" },
                    { text: "Start research", value: "accepted" },
                ],
            },
        });
        return {};
    });
}
