import { randomUUID } from "node:crypto";
import { createNodeEmitter } from "./context.js";
import { decideCoordinatorAction, isChineseLocale, newMessageId, tracedNode } from "./node-utils.js";
export function createCoordinatorNode(ctx) {
    const { llm, trace } = ctx;
    const emit = createNodeEmitter(ctx);
    return async (s, config) => tracedNode(trace, {
        spanId: `span_coordinator_${randomUUID()}`,
        name: "planning.coordinator",
        agent: "coordinator",
        input: { isFeedback: s.isFeedback, resources: s.resources.length },
        currentSpan: ctx.getCurrentSpan(),
        setCurrentSpan: (spanId) => {
            ctx.setCurrentSpan(spanId);
        },
    }, async () => {
        if (s.isFeedback) {
            return { coordinatorAction: "handoff_to_planner" };
        }
        if (s.resources.length > 0) {
            const coordinatorId = newMessageId();
            const content = isChineseLocale(s.locale)
                ? "收到。我会先制定一个学术研究计划，然后检索相关资料并撰写结构化研究报告。"
                : "Got it. I'll draft an academic research plan first, then retrieve evidence and write a structured research report.";
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: s.threadId,
                    id: coordinatorId,
                    agent: "coordinator",
                    role: "assistant",
                    content,
                },
            });
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: s.threadId,
                    id: coordinatorId,
                    agent: "coordinator",
                    role: "assistant",
                    finish_reason: "stop",
                },
            });
            return { coordinatorAction: "handoff_to_planner" };
        }
        const decision = await decideCoordinatorAction({
            llm,
            locale: s.locale,
            userText: s.incomingText,
            ...(config?.signal ? { signal: config.signal } : {}),
        });
        const coordinatorId = newMessageId();
        if (decision.action === "direct_response") {
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: s.threadId,
                    id: coordinatorId,
                    agent: "coordinator",
                    role: "assistant",
                    content: decision.message,
                },
            });
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: s.threadId,
                    id: coordinatorId,
                    agent: "coordinator",
                    role: "assistant",
                    finish_reason: "stop",
                },
            });
            return { coordinatorAction: "direct_response", done: "direct_response" };
        }
        const content = isChineseLocale(s.locale)
            ? "收到。我会先制定一个学术研究计划，然后检索相关资料并撰写结构化研究报告。"
            : "Got it. I'll draft an academic research plan first, then retrieve evidence and write a structured research report.";
        emit(config, {
            type: "message_chunk",
            data: {
                thread_id: s.threadId,
                id: coordinatorId,
                agent: "coordinator",
                role: "assistant",
                content,
            },
        });
        emit(config, {
            type: "message_chunk",
            data: {
                thread_id: s.threadId,
                id: coordinatorId,
                agent: "coordinator",
                role: "assistant",
                finish_reason: "stop",
            },
        });
        return { coordinatorAction: "handoff_to_planner" };
    });
}
