# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

ScholarFlow is a TypeScript academic research assistant with two applications in one repo:

- `src/server/`: Fastify backend that exposes REST and SSE endpoints and runs the multi-agent research workflow.
- `web/`: Next.js 15 / React 19 frontend that streams workflow events, renders chat/research panels, manages settings, uploads resources, and runs Jest tests.

The project is ESM TypeScript throughout. The backend builds to `dist/`; the frontend uses `~/*` as an alias for `web/src/*`.

## Common commands

Run from the repository root unless noted.

```bash
# Install dependencies
npm install
npm --prefix web install

# Start backend and frontend together
npm run dev:all

# Start services separately
npm run dev:server      # Fastify on PORT=8899 with frontend CORS for :3300
npm run dev:web         # delegates to web dev server on port 3300

# Backend checks
npm run typecheck
npm run lint
npm run build

# Frontend checks
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web run build
npm --prefix web run format:check

# Frontend tests
npm --prefix web run test:run
npm --prefix web run test:coverage
npm --prefix web run test:run -- store.test.ts
npm --prefix web run test:run -- tests/message-list-view.test.tsx
```

`web/package.json` declares `pnpm@10.6.5`, and `web/pnpm-lock.yaml` exists, but the root README also documents npm. Keep the lockfile context in mind when changing dependencies.

## Environment

Start from `.env.example` at the repo root. Both backend and frontend read the root `.env`; `web` dev runs through `dotenv -f ../.env`.

Important defaults and variables:

- Backend defaults to `PORT=8899` and `ALLOWED_ORIGINS=http://localhost:3300,http://127.0.0.1:3300`.
- Frontend defaults to `NEXT_PUBLIC_API_URL=http://<current-host>:8899/api/` if unset.
- At least `BASIC_MODEL__MODEL` is needed for full LLM flows; `BASIC_MODEL__API_KEY` and `BASIC_MODEL__BASE_URL` are used for OpenAI-compatible providers.
- `REASONING_MODEL__*` is used when frontend settings enable deep thinking.
- `RAG_PROVIDER=local` reads uploaded `.md`/`.txt` resources directly; `RAG_PROVIDER=lancedb` enables LanceDB vector retrieval and requires `EMBEDDING_MODEL__*`.
- `TAVILY_API_KEY` enables optional web search; without it web search degrades gracefully.
- `ENABLE_MCP_SERVER_CONFIGURATION=true` enables the metadata endpoint, but full MCP tool discovery/execution is not implemented.

## Backend architecture

`src/server/app.ts` owns server startup, CORS, multipart/image parsing, request validation, and all API routes. Key endpoints include:

- `POST /api/chat/stream`: validates `ChatRequestSchema`, creates a `TraceRecorder`, runs `runChatWorkflow`, and writes typed SSE events.
- `GET /api/config`: returns configured model names and RAG provider.
- `POST /api/rag/upload` and `GET /api/rag/resources`: manage local Markdown/TXT resources in `data/rag/`, optionally indexing them in LanceDB.
- `POST /api/prompt/enhance`, `POST /api/report/evaluate`, `POST /api/prose/generate`: editor/report helper flows.
- `GET /api/traces/*`: reads JSONL trace runs from `data/traces/`.

`src/server/schemas.ts` defines the chat contract. Keep frontend request fields in sync with `web/src/core/api/chat.ts` and settings in `web/src/core/store/settings-store.ts`.

`src/server/chat/run-chat-workflow.ts` is the main workflow. It builds two LangGraph graphs:

1. Planning graph: `coordinator -> background_investigator? -> planner -> human_feedback?`.
2. Execution graph: `researcher -> reporter`.

The workflow streams `message_chunk`, `tool_calls`, `tool_call_result`, and `interrupt` events to the frontend. It stores per-thread state only in memory via `ThreadStore`, so restarting the server loses active thread state.

`src/server/workflow.ts` contains prompt builders, plan/report types, fallback plan creation, and plan JSON parsing/normalization. `src/server/llm/*` contains minimal OpenAI-compatible chat and embedding clients that call `/chat/completions` and embeddings-style APIs via `fetch`.

Retrieval is split across:

- `src/server/tools/resources.ts`: local resource retrieval with LanceDB fallback handling.
- `src/server/rag/lancedb-store.ts`: chunking, embedding, table creation, indexing, and vector search.
- `src/server/tools/academic-search.ts` and `src/server/tools/web-search.ts`: external evidence tools used by the workflow.

Tracing is append-only JSONL under `data/traces/<thread>/<run>.jsonl` through `TraceRecorder`; chat streaming records spans, messages, interrupts, and tool calls.

## Frontend architecture

The app uses Next.js App Router:

- `web/src/app/page.tsx` and `web/src/app/landing/*`: landing experience.
- `web/src/app/chat/page.tsx`, `main.tsx`, and `components/*`: chat UI plus side research panel.
- `web/src/app/settings/*`: settings dialogs for general, RAG, and MCP options.

Core frontend modules:

- `web/src/core/api/*`: backend clients. `chat.ts` turns store/settings into `POST /api/chat/stream`; `resolve-service-url.ts` normalizes API URLs to end in `/api/`.
- `web/src/core/sse/fetch-stream.ts`: parses backend Server-Sent Events and enforces `NEXT_PUBLIC_MAX_STREAM_BUFFER_SIZE`.
- `web/src/core/store/store.ts`: global Zustand chat/research state and `sendMessage`, including batching streaming updates and matching `tool_call_result` events back to the message that owns the tool call.
- `web/src/core/messages/*`: message/event types and merge logic.
- `web/src/core/store/settings-store.ts`: persisted localStorage settings that are sent with every chat stream.
- `web/src/components/editor/*`: TipTap/Novel-based report editor and prose-generation actions.

The frontend has mock/replay support in `web/src/core/api/chat.ts`: `?mock` and `?replay=` bypass the backend and stream text fixtures from public files.

## Testing notes

Backend currently has typecheck/lint/build scripts but no test script. Frontend tests are Jest + ts-jest + jsdom under `web/tests/` and use `web/jest.config.mjs` with `~` mapped to `web/src`.

For UI changes, start the relevant dev server(s) and exercise the flow in a browser before calling the work complete. The normal local pair is backend `:8899` and frontend `:3300`.

## Implementation notes

- Validate external input with Zod at API boundaries; backend route schemas and frontend settings/request types must stay aligned.
- SSE event shape changes must be reflected in both `runChatWorkflow`/`sse.ts` and frontend parsing/merge code.
- Uploaded RAG resources are restricted to `.md` and `.txt`; image uploads are restricted to `.png`, `.jpg`, `.jpeg`, `.gif`, and `.webp`.
- The backend sanitizes filenames before writing under `data/rag` and `data/uploads`; preserve this when changing upload paths.
- LanceDB indexing is opportunistic: failures should leave local excerpt retrieval usable.
