import { randomUUID } from "node:crypto";

import type { LangGraphRunnableConfig } from "@langchain/langgraph";

import type { ResearchGraphState } from "../state.js";
import type { ResearchGraphNode } from "./types.js";
import type { NodeFactoryContext } from "./context.js";
import { createNodeEmitter } from "./context.js";
import { academicResultsToToolResult, academicSearch, formatAcademicResults } from "../../tools/academic-search.js";
import { webSearch } from "../../tools/web-search.js";
import type { WorkflowState } from "../../runtime/types.js";
import { academicSearchLimit, buildToolCallChunks, newMessageId, newToolCallId, tracedNode } from "./node-utils.js";
import type { ToolCall } from "../types.js";

export function createBackgroundInvestigatorNode(ctx: NodeFactoryContext): ResearchGraphNode {
  const { trace, store } = ctx;
  const emit = createNodeEmitter(ctx);
  return async (s: ResearchGraphState, config?: LangGraphRunnableConfig) => tracedNode(
    trace,
    {
      spanId: `span_background_investigator_${randomUUID()}`,
      name: "planning.background_investigator",
      agent: "researcher",
      input: { enabled: s.enableBackgroundInvestigation && s.enableWebSearch, query: s.researchTopic },
      currentSpan: ctx.getCurrentSpan(),
      setCurrentSpan: (spanId) => {
        ctx.setCurrentSpan(spanId);
      },
    },
    async () => {
    const shouldPlan = !s.interruptFeedback || s.interruptFeedback === "edit_plan";
    if (!shouldPlan) return {};
    if (!s.enableBackgroundInvestigation || !s.enableWebSearch) return {};

    const academicToolCallId = newToolCallId();
    const webToolCallId = newToolCallId();
    const researcherId = newMessageId();
    const maxAcademicResults = academicSearchLimit(s);
    const toolCalls: ToolCall[] = [
      {
        type: "tool_call",
        id: academicToolCallId,
        name: "academic_search",
        args: { query: s.researchTopic, max_results: maxAcademicResults },
      },
      {
        type: "tool_call",
        id: webToolCallId,
        name: "web_search",
        args: { query: s.researchTopic, max_results: s.maxSearchResults },
      },
    ];
    const toolCallChunks = buildToolCallChunks(toolCalls);

    emit(config, {
      type: "tool_calls",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        tool_calls: toolCalls,
        tool_call_chunks: toolCallChunks,
      },
    });
    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        finish_reason: "tool_calls",
      },
    });

    let academicText = "";
    let academicToolResult = "[]";
    try {
      const results = await academicSearch({
        query: s.researchTopic,
        maxResults: maxAcademicResults,
        ...(config?.signal ? { signal: config.signal } : {}),
      });
      academicText = formatAcademicResults(results);
      academicToolResult = academicResultsToToolResult(results);
    } catch (e) {
      academicText = e instanceof Error ? e.message : String(e);
      academicToolResult = JSON.stringify([{ type: "page", title: academicText, url: "", content: "" }]);
    }

    emit(config, {
      type: "tool_call_result",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "tool",
        tool_call_id: academicToolCallId,
        content: academicToolResult,
      },
    });

    let webText = "";
    let webToolResult = "[]";
    try {
      const results = await webSearch({
        query: s.researchTopic,
        maxResults: s.maxSearchResults,
        ...(config?.signal ? { signal: config.signal } : {}),
      });
      webText = results.length
        ? results
            .map((r, i) => `- [${i + 1}] ${r.title} (${r.url})${r.content ? `\n  ${r.content}` : ""}`)
            .join("\n")
        : "(no web search results)";
      webToolResult = JSON.stringify(
        results.map((r) => ({
          type: "page",
          title: r.title,
          url: r.url,
          content: r.content ?? "",
        })),
      );
    } catch (e) {
      webText = e instanceof Error ? e.message : String(e);
      webToolResult = JSON.stringify([{ type: "page", title: webText, url: "", content: "" }]);
    }

    emit(config, {
      type: "tool_call_result",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "tool",
        tool_call_id: webToolCallId,
        content: webToolResult,
      },
    });

    const investigationText = [`Academic literature search:\n${academicText}`, `Web search:\n${webText}`].join("\n\n");
    store.set({ ...(s as WorkflowState), backgroundInvestigationResults: investigationText });

    return { backgroundInvestigationResults: investigationText };
    },
  );
}
