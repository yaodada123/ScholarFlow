# DeerFlow TS (Unofficial)

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

This repository is an **unofficial TypeScript re-implementation** of ByteDance’s open-source project **DeerFlow**, aiming to switch the server side to TypeScript while keeping the original Web UI working with zero/minimal changes.

- Original project (credits): https://github.com/bytedance/deer-flow
- This repo: a more engineering-oriented TS server, gradually catching up with the original features

## Demo

### Video

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## Current Status (Capabilities)

- Server & protocol
  - Fastify + TypeScript (ESM)
  - SSE streaming endpoint: `POST /api/chat/stream`
  - Config endpoint: `GET /api/config` (returns models and `rag.provider`)
- Multi-agent workflow (Planning + Research)
  - Coordinator: decides direct chat vs. research workflow
  - Planner: produces a structured research plan (supports human feedback edits / auto-accept)
  - Researcher: runs retrieval (local RAG / optional Web Search) and accumulates Observations
  - Reporter: generates the final Markdown report based on the plan and observations (supports report style)
- Local RAG (minimal working loop)
  - Upload: `POST /api/rag/upload` (only `.md` / `.txt`)
  - List/search: `GET /api/rag/resources?query=`
  - Reference: select resources via `@` in the input box, URI format `rag://local/<file>`
  - Retrieval injection: reads an excerpt from `data/rag/<file>` and injects it into the workflow
- Web Search (optional)
  - Integrated Tavily (enabled when `TAVILY_API_KEY` is set)
  - Controlled via the frontend toggle `enable_web_search`
- MCP (compat placeholder)
  - `POST /api/mcp/server/metadata` (for the frontend settings page)

> Note: this is still “WIP”. The current priority is Web UI compatibility and a closed-loop core workflow.

## Quick Start

### Requirements

- Node.js >= 20

### Install dependencies

In the repository root:

```bash
npm install
```

Frontend dependencies live under `web/` (install once):

```bash
cd web
npm install
```

### Environment (.env)

By default, the project reads `.env` from the repo root (server via `dotenv`, frontend dev via `dotenv -f ../.env`).

Start from the example:

```bash
cp .env.example .env
```

Then fill in at least one working LLM config (example):

```ini
BASIC_MODEL__MODEL=
BASIC_MODEL__API_KEY=
# BASIC_MODEL__BASE_URL=https://api.openai.com/v1
```

> Note: `.env` usually contains secrets. Do not commit it to a public repo.

### Start (recommended, one command for both)

```bash
npm run dev:all
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Start separately

```bash
npm run dev:server
npm run dev:web
```

## Project Layout

- `src/server/`: TypeScript backend
- `data/rag/`: local RAG file storage (uploads go here)
- `web/`: original Web UI (compat target)

## Common Config (Environment Variables)

- `NEXT_PUBLIC_API_URL`: frontend API base URL (e.g. `http://localhost:8000/api`)
- `PORT`: backend port (default 8000)
- `ALLOWED_ORIGINS`: CORS allowlist (default `http://localhost:3000,http://127.0.0.1:3000`)
- `RAG_PROVIDER`: RAG provider (defaults to `local` if not set)
- `ENABLE_MCP_SERVER_CONFIGURATION`: enable MCP server configuration (default false; enabled by `npm run dev:server` / `dev:all`)
- `BASIC_MODEL__*` / `REASONING_MODEL__*`: model config (minimum: `BASIC_MODEL__MODEL` and `BASIC_MODEL__API_KEY`)
- `TAVILY_API_KEY`: enable Web Search (no key => automatically disabled)

## Roadmap

- More complete RAG: chunking, indexing, vector retrieval/reranking, resource management (delete/rename/download)
- More complete MCP: tool discovery, tool calling, deeper workflow integration
- More API compatibility with the original (evaluation, podcast, prompt enhancer, etc.)
- Improve English docs and add more translations

## Disclaimer

- This is an unofficial implementation and is not affiliated with the original authors/maintainers. If anything is inappropriate, please contact me.
