# ScholarFlow

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

**ScholarFlow** is a multi-agent academic research system built with TypeScript, Fastify, LangGraph, and Next.js.

It helps users turn a broad interest area into concrete research topic directions, retrieve academic evidence from local materials, arXiv, OpenAlex, and optional web sources, then generate, evaluate, and edit grounded Markdown research reports. The project focuses on a controllable, observable, evidence-aware workflow for topic discovery and literature investigation rather than a generic one-shot chatbot.

## Demo

### Video

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## Current Status (Capabilities)

- Topic-direction research workflow
  - Coordinator: decides direct response vs. academic research workflow
  - Planner: proposes candidate topic directions, research questions, feasibility, novelty, and an evidence plan
  - Human feedback: lets users review, accept, or edit the plan before execution
  - Researcher: retrieves local papers/notes, free academic search results, and optional web evidence
  - Reporter: generates a structured Markdown research report based on the plan, evidence, and sources
- Academic evidence retrieval
  - Local RAG: upload Markdown/TXT papers, notes, or course materials and reference them via `@`
  - Free academic search: arXiv + OpenAlex for papers, metadata, DOI links, authors, years, concepts, and citation counts
  - Optional Web Search: Tavily is enabled when `TAVILY_API_KEY` is set
- Report refinement and quality loop
  - Prompt enhancement: `POST /api/prompt/enhance`
  - Report evaluation: `POST /api/report/evaluate` with automated metrics and optional LLM-as-judge
  - Editor prose generation: `POST /api/prose/generate`
  - Report export and local image upload support
- Server & protocol
  - Fastify + TypeScript (ESM)
  - SSE streaming endpoint: `POST /api/chat/stream`
  - Config endpoint: `GET /api/config` (returns models and `rag.provider`)
- MCP and Podcast
  - MCP metadata endpoint exists for settings integration, but full tool discovery/execution is not enabled yet
  - Podcast/TTS endpoint returns a clear unsupported response until a TTS provider is configured

> Note: the current version prioritizes an end-to-end topic discovery and academic report loop: propose directions, retrieve evidence, synthesize findings, evaluate quality, and edit the report. Advanced citation grounding, PDF ingestion, vector RAG, and full MCP tool execution remain planned improvements.

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

Then fill in at least one OpenAI-compatible LLM config. Example for DeepSeek:

```ini
BASIC_MODEL__MODEL=deepseek-chat
BASIC_MODEL__API_KEY=sk-your-deepseek-api-key
BASIC_MODEL__BASE_URL=https://api.deepseek.com

# Optional reasoning model for deep-thinking mode
# REASONING_MODEL__MODEL=deepseek-reasoner
# REASONING_MODEL__API_KEY=sk-your-deepseek-api-key
# REASONING_MODEL__BASE_URL=https://api.deepseek.com
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
- More academic search integrations: Semantic Scholar, CrossRef, and BibTeX workflows
- Stronger evaluation suite for plan quality, evidence coverage, citation accuracy, and hallucination risk
- Full MCP tool discovery, safe execution, and workflow integration
- Optional TTS provider integration for podcast/audio report generation

## Acknowledgments

ScholarFlow is inspired by modern deep-research style agents and the broader open-source LLM ecosystem. It is built as a TypeScript engineering implementation focused on academic research workflows.
