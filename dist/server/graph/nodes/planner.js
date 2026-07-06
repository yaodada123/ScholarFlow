import { randomUUID } from "node:crypto";
import { createNodeEmitter } from "./context.js";
import { formatSkillPromptBlock } from "../../skills/prompt.js";
import { getSkills } from "../../skills/registry.js";
import { buildFallbackPlan, buildPlannerEditPrompt, buildPlannerPrompt, ensureTopicPlanFields, safeParsePlan } from "../../workflow.js";
import { newMessageId, stripThinkTags, tracedNode } from "./node-utils.js";
export function createPlannerNode(ctx) {
    const { llm, trace, store } = ctx;
    const emit = createNodeEmitter(ctx);
    return async (s, config) => tracedNode(trace, {
        spanId: `span_planner_${randomUUID()}`,
        name: "planning.planner",
        agent: "planner",
        input: { isFeedback: s.isFeedback, interruptFeedback: s.interruptFeedback, planIterations: s.planIterations },
        currentSpan: ctx.getCurrentSpan(),
        setCurrentSpan: (spanId) => {
            ctx.setCurrentSpan(spanId);
        },
    }, async () => {
        const shouldPlan = !s.interruptFeedback || s.interruptFeedback === "edit_plan";
        if (!shouldPlan) {
            return { plannerShouldInterrupt: false, done: "none" };
        }
        let next = s;
        const plannerId = newMessageId();
        const isEditing = s.interruptFeedback === "edit_plan";
        const plannerSkillContext = formatSkillPromptBlock(getSkills(next.activeSkills), "planner");
        const prompt = isEditing && next.currentPlan
            ? buildPlannerEditPrompt({
                locale: next.locale,
                query: next.researchTopic,
                currentPlan: next.currentPlan,
                instruction: s.incomingText,
                maxSteps: next.maxStepNum,
                enableWebSearch: next.enableWebSearch,
                backgroundInvestigationResults: next.backgroundInvestigationResults,
                skillContext: plannerSkillContext,
            })
            : buildPlannerPrompt({
                query: next.researchTopic,
                locale: next.locale,
                maxSteps: next.maxStepNum,
                enableWebSearch: next.enableWebSearch,
                backgroundInvestigationResults: next.backgroundInvestigationResults,
                skillContext: plannerSkillContext,
            });
        if (!llm) {
            const plan = buildFallbackPlan({
                query: next.researchTopic,
                maxSteps: next.maxStepNum,
                enableWebSearch: next.enableWebSearch,
            });
            const planText = JSON.stringify(plan, null, 2);
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: next.threadId,
                    id: plannerId,
                    agent: "planner",
                    role: "assistant",
                    content: planText,
                },
            });
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: next.threadId,
                    id: plannerId,
                    agent: "planner",
                    role: "assistant",
                    finish_reason: "stop",
                },
            });
            next = { ...next, currentPlan: plan, planIterations: next.planIterations + 1 };
            store.set(next);
        }
        else {
            let fullText = "";
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: next.threadId,
                    id: plannerId,
                    agent: "planner",
                    role: "assistant",
                    reasoning_content: "Planning…",
                },
            });
            try {
                for await (const delta of llm.streamChatCompletions({
                    messages: [
                        { role: "system", content: prompt.system },
                        { role: "user", content: prompt.user },
                    ],
                    ...(config?.signal ? { signal: config.signal } : {}),
                })) {
                    if (delta.reasoningContent) {
                        emit(config, {
                            type: "message_chunk",
                            data: {
                                thread_id: next.threadId,
                                id: plannerId,
                                agent: "planner",
                                role: "assistant",
                                reasoning_content: delta.reasoningContent,
                            },
                        });
                    }
                    if (delta.content) {
                        fullText += stripThinkTags(delta.content);
                    }
                }
            }
            catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                emit(config, {
                    type: "message_chunk",
                    data: {
                        thread_id: next.threadId,
                        id: plannerId,
                        agent: "planner",
                        role: "assistant",
                        reasoning_content: `Planner stream failed: ${message}`,
                    },
                });
            }
            const parsedPlan = ensureTopicPlanFields({
                plan: safeParsePlan(fullText) ??
                    buildFallbackPlan({
                        query: next.researchTopic,
                        maxSteps: next.maxStepNum,
                        enableWebSearch: next.enableWebSearch,
                    }),
                query: next.researchTopic,
                enableWebSearch: next.enableWebSearch,
            });
            const json = JSON.stringify(parsedPlan, null, 2);
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: next.threadId,
                    id: plannerId,
                    agent: "planner",
                    role: "assistant",
                    content: json,
                },
            });
            emit(config, {
                type: "message_chunk",
                data: {
                    thread_id: next.threadId,
                    id: plannerId,
                    agent: "planner",
                    role: "assistant",
                    finish_reason: "stop",
                },
            });
            next = { ...next, currentPlan: parsedPlan, planIterations: next.planIterations + 1 };
            store.set(next);
        }
        const shouldRun = next.autoAcceptedPlan || s.interruptFeedback === "accepted";
        if (!shouldRun) {
            return { plannerShouldInterrupt: true, done: "interrupt_ready" };
        }
        return {
            plannerShouldInterrupt: false,
            done: "none",
            currentPlan: next.currentPlan,
            planIterations: next.planIterations,
            backgroundInvestigationResults: next.backgroundInvestigationResults,
        };
    });
}
