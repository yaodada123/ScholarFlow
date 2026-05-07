# ScholarFlow

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

**ScholarFlow** is a multi-agent academic research assistant built with TypeScript, Fastify, LangGraph, and Next.js.

It helps users turn research questions into structured research plans, retrieve evidence from local academic materials or optional web sources, and generate grounded Markdown research reports. The project focuses on a controllable, observable, and human-in-the-loop research workflow rather than a generic one-shot chatbot.

## Demo

### Video

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## Current Status (Capabilities)

- Academic research workflow
  - Coordinator: decides direct response vs. academic research workflow
  - Planner: produces a structured research plan for the user's research question
  - Human feedback: lets users review, accept, or edit the plan before execution
  - Researcher: retrieves local notes/papers and optional web evidence, then accumulates observations
  - Reporter: generates a structured Markdown research report based on the plan, evidence, and sources
- Server & protocol
  - Fastify + TypeScript (ESM)
  - SSE streaming endpoint: `POST /api/chat/stream`
  - Config endpoint: `GET /api/config` (returns models and `rag.provider`)
- Local academic RAG (minimal working loop)
  - Upload: `POST /api/rag/upload` (only `.md` / `.txt`)
  - List/search: `GET /api/rag/resources?query=`
  - Reference: select papers, notes, or research materials via `@` in the input box
  - Resource URI format: `rag://local/<file>`
  - Retrieval injection: reads an excerpt from `data/rag/<file>` and injects it into the research workflow
- Web Search (optional)
  - Integrated Tavily (enabled when `TAVILY_API_KEY` is set)
  - Controlled via the frontend toggle `enable_web_search`
- MCP (configuration placeholder)
  - `POST /api/mcp/server/metadata` (for frontend settings integration)

> Note: the current version prioritizes an end-to-end academic research loop: plan, retrieve, synthesize, and report. RAG quality, citation grounding, and external academic search integrations are planned improvements.

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

- `src/server/`: TypeScript backend and academic research workflow implementation
- `data/rag/`: local academic material storage (uploaded Markdown/TXT files go here)
- `web/`: Next.js web interface
- `docs/academic-agent-interview-packaging.md`: interview positioning and project explanation notes

## Common Config (Environment Variables)

- `NEXT_PUBLIC_API_URL`: frontend API base URL (e.g. `http://localhost:8000/api`)
- `PORT`: backend port (default 8000)
- `ALLOWED_ORIGINS`: CORS allowlist (default `http://localhost:3000,http://127.0.0.1:3000`)
- `RAG_PROVIDER`: RAG provider (defaults to `local` if not set)
- `ENABLE_MCP_SERVER_CONFIGURATION`: enable MCP server configuration (default false; enabled by `npm run dev:server` / `dev:all`)
- `BASIC_MODEL__*` / `REASONING_MODEL__*`: model config (minimum: `BASIC_MODEL__MODEL` and `BASIC_MODEL__API_KEY`)
- `TAVILY_API_KEY`: enable Web Search (no key => automatically disabled)

## Roadmap

- Academic RAG upgrades: chunking, indexing, vector retrieval, reranking, and metadata filtering
- PDF paper ingestion, section-aware parsing, and bibliography extraction
- Citation grounding: bind report claims to concrete source excerpts
- Academic search tools: arXiv, Semantic Scholar, CrossRef, BibTeX workflows
- Evaluation suite for plan quality, evidence coverage, citation accuracy, and hallucination risk
- More complete MCP tool discovery and workflow integration

## Acknowledgments

ScholarFlow is inspired by modern deep-research style agents and the broader open-source LLM ecosystem. It is built as a TypeScript engineering implementation focused on academic research workflows.
