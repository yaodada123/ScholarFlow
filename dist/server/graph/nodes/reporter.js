import { randomUUID } from "node:crypto";
import { createNodeEmitter } from "./context.js";
import { formatSkillPromptBlock } from "../../skills/prompt.js";
import { getSkills } from "../../skills/registry.js";
import { buildFallbackPlan, buildReporterPrompt } from "../../workflow.js";
import { buildReportSources, newMessageId, stripThinkTags, tracedNode } from "./node-utils.js";
export function createReporterNode(ctx) {
    const { llm, trace } = ctx;
    const emit = createNodeEmitter(ctx);
    return async (s, config) => tracedNode(trace, {
        spanId: `span_reporter_${randomUUID()}`,
        name: "execution.reporter",
        agent: "reporter",
        input: { observations: s.observations.length, resources: s.resources.length, style: s.reportStyle },
        currentSpan: ctx.getCurrentSpan(),
        setCurrentSpan: (spanId) => {
            ctx.setCurrentSpan(spanId);
        },
    }, async () => {
        const reporterId = newMessageId();
        const sources = buildReportSources({
            resources: s.resources,
            observations: s.observations,
        });
        const style = s.reportStyle;
        const observations = s.observations;
        const planForReport = s.currentPlan ??
            buildFallbackPlan({
                query: s.researchTopic,
                maxSteps: s.maxStepNum,
                enableWebSearch: s.enableWebSearch,
            });
        if (!llm) {
            const fallback = [
                `# ${s.researchTopic || planForReport.title || "Report"}`,
                "",
                `Style: ${style ?? "default"}`,
                "",
                "## Plan",
                planForReport.steps.map((step, i) => `${i + 1}. ${step.title} — ${step.description}`).join("\n"),
                "",
                "## Notes",
                observations.length ? observations.join("\n\n") : "(none)",
                "",
                "## Answer",
                "LLM is not configured. Set BASIC_MODEL__MODEL and BASIC_MODEL__API_KEY to enable full academic report generation.",
            ].join("\n");
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: s.threadId,
                    id: reporterId,
                    agent: "reporter",
                    role: "assistant",
                    content: fallback,
                },
            });
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: s.threadId,
                    id: reporterId,
                    agent: "reporter",
                    role: "assistant",
                    finish_reason: "stop",
                },
            });
            return {};
        }
        const reportPrompt = buildReporterPrompt({
            query: s.researchTopic,
            locale: s.locale,
            style,
            plan: planForReport,
            observations,
            sources,
            skillContext: formatSkillPromptBlock(getSkills(s.activeSkills), "reporter"),
        });
        emit(config, {
            type: "message_chunk",
            data: {
                thread_id: s.threadId,
                id: reporterId,
                agent: "reporter",
                role: "assistant",
                reasoning_content: "Writing…",
            },
        });
        try {
            for await (const delta of llm.streamChatCompletions({
                messages: [
                    { role: "system", content: reportPrompt.system },
                    { role: "user", content: reportPrompt.user },
                ],
                ...(config?.signal ? { signal: config.signal } : {}),
            })) {
                if (delta.reasoningContent) {
                    emit(config, {
                        type: "message_chunk",
                        data: {
                            thread_id: s.threadId,
                            id: reporterId,
                            agent: "reporter",
                            role: "assistant",
                            reasoning_content: delta.reasoningContent,
                        },
                    });
                }
                if (delta.content) {
                    const cleaned = stripThinkTags(delta.content);
                    if (!cleaned)
                        continue;
                    emit(config, {
                        type: "message_chunk",
                        data: {
                            thread_id: s.threadId,
                            id: reporterId,
                            agent: "reporter",
                            role: "assistant",
                            content: cleaned,
                        },
                    });
                }
            }
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: s.threadId,
                    id: reporterId,
                    agent: "reporter",
                    role: "assistant",
                    content: `\n\n[reporter_error] ${message}`,
                },
            });
        }
        emit(config, {
            type: "message_chunk",
            data: {
                thread_id: s.threadId,
                id: reporterId,
                agent: "reporter",
                role: "assistant",
                finish_reason: "stop",
            },
        });
        return {};
    });
}
