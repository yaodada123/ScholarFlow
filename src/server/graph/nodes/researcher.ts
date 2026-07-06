import { randomUUID } from "node:crypto";

import type { LangGraphRunnableConfig } from "@langchain/langgraph";

import type { ResearchGraphState } from "../state.js";
import type { ResearchGraphNode } from "./types.js";
import type { NodeFactoryContext } from "./context.js";
import { createNodeEmitter } from "./context.js";
import { callMcpTool } from "../../mcp/client.js";
import type { ToolCall as LlmToolCall } from "../../llm/openai-compatible.js";
import { mcpToolsToOpenAiTools, resolveEnabledMcpTools } from "../../mcp/tools.js";
import { formatSkillPromptBlock } from "../../skills/prompt.js";
import { getSkills } from "../../skills/registry.js";
import { academicResultsToToolResult, academicSearch, formatAcademicResults } from "../../tools/academic-search.js";
import { retrieveResources } from "../../tools/resources.js";
import type { WorkflowState } from "../../runtime/types.js";
import {
  academicSearchLimit,
  buildMcpResearchPrompt,
  buildToolCallChunks,
  hasSkill,
  newMessageId,
  newToolCallId,
  openAiToolCallToSse,
  toolResultContent,
  tracedNode,
} from "./node-utils.js";
import type { ToolCall } from "../types.js";

export function createResearcherNode(ctx: NodeFactoryContext): ResearchGraphNode {
  const { llm, trace, store, request } = ctx;
  const emit = createNodeEmitter(ctx);
  return async (s: ResearchGraphState, config?: LangGraphRunnableConfig) => tracedNode(
    trace,
    {
      spanId: `span_researcher_${randomUUID()}`,
      name: "execution.researcher",
      agent: "researcher",
      input: { query: s.researchTopic, resources: s.resources.length, enableWebSearch: s.enableWebSearch },
      currentSpan: ctx.getCurrentSpan(),
      setCurrentSpan: (spanId) => {
        ctx.setCurrentSpan(spanId);
      },
    },
    async () => {
    const researcherId = newMessageId();
    const researcherSkillContext = formatSkillPromptBlock(getSkills(s.activeSkills), "researcher");
    const maxAcademicResults = academicSearchLimit(s);
    const retrieved = await retrieveResources({
      query: s.researchTopic,
      resources: s.resources,
      limit: Math.max(1, Math.min(10, s.maxSearchResults)),
    });

    const retrieveToolCallId = newToolCallId();
    const academicToolCallId = newToolCallId();
    const toolCalls: ToolCall[] = [
      {
        type: "tool_call",
        id: retrieveToolCallId,
        name: "retrieve_resources",
        args: { query: s.researchTopic, limit: retrieved.length },
      },
      ...(s.enableWebSearch
        ? [
            {
              type: "tool_call" as const,
              id: academicToolCallId,
              name: "academic_search",
              args: { query: s.researchTopic, max_results: maxAcademicResults },
            },
          ]
        : []),
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

    const retrievalText = retrieved
      .map((r, i) => {
        const desc = r.description ? `\n  ${r.description}` : "";
        const excerpt = r.excerpt
          ? `\n  Content:\n${r.excerpt
              .split("\n")
              .map((line) => `  ${line}`)
              .join("\n")}`
          : "";
        return `- [${i + 1}] ${r.title} (${r.uri})${desc}${excerpt}`;
      })
      .join("\n");
    const retrievalToolResult = JSON.stringify(
      retrieved.map((r, i) => ({
        type: "resource",
        id: r.uri,
        title: r.title,
        url: r.uri,
        content: r.excerpt ?? r.description ?? `Resource ${i + 1}`,
      })),
    );

    emit(config, {
      type: "tool_call_result",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "tool",
        tool_call_id: retrieveToolCallId,
        content: retrievalToolResult,
      },
    });

    let academicText = "";
    if (s.enableWebSearch) {
      try {
        const academicResults = await academicSearch({
          query: s.researchTopic,
          maxResults: maxAcademicResults,
          ...(config?.signal ? { signal: config.signal } : {}),
        });
        academicText = formatAcademicResults(academicResults);
        emit(config, {
          type: "tool_call_result",
          data: {
            thread_id: s.threadId,
            id: researcherId,
            agent: "researcher",
            role: "tool",
            tool_call_id: academicToolCallId,
            content: academicResultsToToolResult(academicResults),
          },
        });
      } catch (e) {
        academicText = e instanceof Error ? e.message : String(e);
        emit(config, {
          type: "tool_call_result",
          data: {
            thread_id: s.threadId,
            id: researcherId,
            agent: "researcher",
            role: "tool",
            tool_call_id: academicToolCallId,
            content: JSON.stringify([{ type: "page", title: academicText, url: "", content: "" }]),
          },
        });
      }
    }

    const mcpTools = resolveEnabledMcpTools({ settings: request.mcp_settings, agent: "researcher" });
    const mcpToolByName = new Map(mcpTools.map((tool) => [tool.openAiName, tool]));
    const mcpObservations: string[] = [];

    if (llm && mcpTools.length) {
      const mcpMessages = buildMcpResearchPrompt({
        state: s,
        retrievedText: retrievalText,
        academicText,
        skillContext: researcherSkillContext,
        mcpTools,
      });
      const mcpOpenAiTools = mcpToolsToOpenAiTools(mcpTools);
      let pendingToolCalls: LlmToolCall[] = [];
      try {
        const completion = await llm.createChatCompletion({
          messages: mcpMessages,
          tools: mcpOpenAiTools,
          toolChoice: "auto",
          ...(config?.signal ? { signal: config.signal } : {}),
        });
        pendingToolCalls = completion.toolCalls ?? [];
      } catch (e) {
        mcpObservations.push(`MCP tool planning failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      const boundedToolCalls = pendingToolCalls.slice(0, 4).filter((toolCall) => mcpToolByName.has(toolCall.name));
      if (boundedToolCalls.length) {
        const sseToolCalls = boundedToolCalls.map(openAiToolCallToSse);
        emit(config, {
          type: "tool_calls",
          data: {
            thread_id: s.threadId,
            id: researcherId,
            agent: "researcher",
            role: "assistant",
            tool_calls: sseToolCalls,
            tool_call_chunks: buildToolCallChunks(sseToolCalls),
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
      }

      for (const toolCall of boundedToolCalls) {
        const tool = mcpToolByName.get(toolCall.name);
        if (!tool) continue;
        let resultText = "";
        try {
          const result = await callMcpTool(tool.config, tool.toolName, toolCall.args);
          resultText = result.content;
        } catch (e) {
          resultText = `MCP tool error: ${e instanceof Error ? e.message : String(e)}`;
        }
        mcpObservations.push(`MCP tool ${tool.openAiName} (${tool.serverName}/${tool.toolName}) result:\n${resultText}`);
        emit(config, {
          type: "tool_call_result",
          data: {
            thread_id: s.threadId,
            id: researcherId,
            agent: "researcher",
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResultContent(tool.openAiName, resultText),
          },
        });
      }
    }

    emit(config, {
      type: "message_chunk",
      data: {
        thread_id: s.threadId,
        id: researcherId,
        agent: "researcher",
        role: "assistant",
        finish_reason: "stop",
      },
    });

    const updates = [
      researcherSkillContext ? `Active research skill guidance:\n${researcherSkillContext}` : null,
      hasSkill(s, "academic-paper-review") && s.resources.length
        ? "Paper review evidence note: prioritize uploaded or selected paper content. If the available content is incomplete, the final review must state that limitation."
        : null,
      hasSkill(s, "deep-research")
        ? "Deep research evidence note: synthesize across multiple angles, including facts, examples, current trends, comparisons, and limitations when available."
        : null,
      s.backgroundInvestigationResults ? `Background investigation:\n${s.backgroundInvestigationResults}` : null,
      retrievalText ? `Retrieved resources:\n${retrievalText}` : null,
      academicText ? `Academic literature search:\n${academicText}` : null,
      mcpObservations.length ? `MCP tool evidence:\n${mcpObservations.join("\n\n")}` : null,
    ].filter((x): x is string => Boolean(x));

    const next = {
      ...(s as WorkflowState),
      observations: [...s.observations, ...updates],
    };
    store.set(next);

    return { observations: next.observations };
    },
  );
}
