# MCP Complete Basic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete-basic MCP support with official SDK-backed metadata discovery and researcher tool execution.

**Architecture:** Add a focused backend MCP module that normalizes user MCP configs, creates SDK clients for stdio/SSE/streamable HTTP transports, lists tools, and calls tools with timeouts. Integrate discovered enabled tools into the researcher LLM loop and emit existing SSE `tool_calls` / `tool_call_result` events so the frontend display path remains unchanged.

**Tech Stack:** TypeScript ESM, Fastify, LangGraph workflow, OpenAI-compatible chat tools/function calling, `@modelcontextprotocol/sdk`.

---

### Task 1: Add MCP SDK and backend types

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/server/mcp/types.ts`

- [ ] Install `@modelcontextprotocol/sdk` using `npm install @modelcontextprotocol/sdk`.
- [ ] Define server config, tool metadata, execution result, and OpenAI tool conversion types in `src/server/mcp/types.ts`.
- [ ] Run `npm run typecheck` and fix type errors introduced by dependency metadata.

### Task 2: Implement SDK client service

**Files:**
- Create: `src/server/mcp/client.ts`
- Create: `src/server/mcp/tools.ts`

- [ ] Implement transport creation for `stdio`, `sse`, and `streamable_http` using official SDK transports.
- [ ] Implement `listMcpServerTools(config)` that connects, lists tools, normalizes descriptions/input schemas, and closes the client.
- [ ] Implement `callMcpTool(config, toolName, args)` that connects, calls a tool, serializes MCP content into a readable string/JSON payload, and closes the client.
- [ ] Implement enabled-tool filtering and OpenAI function-tool conversion in `tools.ts`.

### Task 3: Wire metadata endpoint

**Files:**
- Modify: `src/server/app.ts`

- [ ] Replace placeholder `tools: []` response with `listMcpServerTools(parsed)`.
- [ ] Preserve feature flag behavior and return a clear 400 error if connection/listing fails.

### Task 4: Add LLM tool calling support

**Files:**
- Modify: `src/server/llm/openai-compatible.ts`

- [ ] Extend chat completion request options to accept OpenAI `tools` and `tool_choice` fields.
- [ ] Preserve existing streaming delta parsing for `tool_calls`.

### Task 5: Integrate MCP in researcher

**Files:**
- Modify: `src/server/chat/run-chat-workflow.ts`

- [ ] Resolve enabled MCP tools from `request.mcp_settings` for the `researcher` agent.
- [ ] Include MCP tool descriptions in researcher prompt context and OpenAI tools list.
- [ ] Add a bounded tool-call loop for researcher: model proposes MCP calls, server executes via SDK, emits SSE results, and appends summarized observations.
- [ ] Keep built-in `retrieve_resources` and `academic_search` behavior intact.

### Task 6: Validate end-to-end

**Files:**
- Modify only if typecheck/build exposes issues.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Optionally test against a local MCP server config in the UI to confirm tool discovery displays real tools.

### Self-Review

- Spec coverage: metadata discovery, stdio/SSE/streamable HTTP, enabled tool filtering, researcher execution, SSE display, and timeout/error isolation are covered.
- Placeholder scan: no implementation placeholders remain in this plan.
- Type consistency: names use `McpServerConfig`, `McpToolMetadata`, `listMcpServerTools`, and `callMcpTool` consistently.
