# DeerFlow TS (Não oficial)

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

Este repositório é uma **reimplementação não oficial em TypeScript** do **DeerFlow** original (ByteDance). O objetivo é manter a compatibilidade com a Web UI existente e migrar o servidor para TypeScript.

- Projeto original (créditos): https://github.com/bytedance/deer-flow

## Demonstração

### Vídeo

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## Estado atual (capacidades)

- Servidor e protocolo
  - Fastify + TypeScript (ESM)
  - Endpoint SSE de streaming: `POST /api/chat/stream`
  - Endpoint de configuração: `GET /api/config` (retorna models e `rag.provider`)
- Workflow multiagente (Planning + Research)
  - Coordinator: decide entre chat direto e fluxo de pesquisa
  - Planner: gera um plano de pesquisa estruturado (suporta edição via feedback humano / aceitação automática)
  - Researcher: executa retrieval (RAG local / Web Search opcional) e acumula Observations
  - Reporter: gera o relatório final em Markdown com base no plano e observações (suporta report style)
- RAG local (ciclo mínimo funcional)
  - Upload: `POST /api/rag/upload` (apenas `.md` / `.txt`)
  - Lista/busca: `GET /api/rag/resources?query=`
  - Referência: selecionar recursos via `@` no input, URI `rag://local/<file>`
  - Injeção na recuperação: lê trechos de `data/rag/<file>` e injeta no workflow
- Web Search (opcional)
  - Tavily integrado (habilita quando `TAVILY_API_KEY` está configurado)
  - Controlado pelo toggle do frontend `enable_web_search`
- MCP (placeholder de compatibilidade)
  - `POST /api/mcp/server/metadata` (para a página de configurações do frontend)

> Observação: ainda é “WIP”. A prioridade atual é compatibilidade com a Web UI e fechar o fluxo principal.

## Início rápido

### Requisitos

- Node.js >= 20

### Instalar dependências

Na raiz do repositório:

```bash
npm install
```

As dependências do frontend ficam em `web/` (instalar uma vez):

```bash
cd web
npm install
```

### Ambiente (.env)

Por padrão, o projeto lê `.env` da raiz (server via `dotenv`, frontend dev via `dotenv -f ../.env`).

Comece pelo exemplo:

```bash
cp .env.example .env
```

Depois, complete ao menos uma configuração de LLM válida (exemplo):

```ini
BASIC_MODEL__MODEL=
BASIC_MODEL__API_KEY=
# BASIC_MODEL__BASE_URL=https://api.openai.com/v1
```

> Observação: `.env` normalmente contém segredos. Não faça commit em repositório público.

### Iniciar (recomendado, um comando para ambos)

```bash
npm run dev:all
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Iniciar separadamente

```bash
npm run dev:server
npm run dev:web
```

## Estrutura do projeto

- `src/server/`: backend TypeScript
- `data/rag/`: armazenamento local de arquivos RAG (uploads são salvos aqui)
- `web/`: Web UI original (alvo de compatibilidade)

## Configuração comum (variáveis de ambiente)

- `NEXT_PUBLIC_API_URL`: base URL da API para o frontend (ex.: `http://localhost:8000/api`)
- `PORT`: porta do backend (padrão 8000)
- `ALLOWED_ORIGINS`: allowlist CORS (padrão `http://localhost:3000,http://127.0.0.1:3000`)
- `RAG_PROVIDER`: provedor de RAG (se não definido => `local`)
- `ENABLE_MCP_SERVER_CONFIGURATION`: habilitar configuração de MCP (padrão false; habilitado por `npm run dev:server` / `dev:all`)
- `BASIC_MODEL__*` / `REASONING_MODEL__*`: configuração de modelos (mínimo: `BASIC_MODEL__MODEL` e `BASIC_MODEL__API_KEY`)
- `TAVILY_API_KEY`: habilitar Web Search (sem key => desabilitado automaticamente)

## Roadmap

- RAG mais completo: chunking, indexação, retrieval/reranking vetorial, gestão de recursos (delete/rename/download)
- MCP mais completo: descoberta de ferramentas, chamadas de ferramentas, integração mais profunda no workflow
- Mais compatibilidade de API com o original (avaliação, podcast, prompt enhancer, etc.)
- Melhorar documentação em inglês e adicionar mais traduções

## Aviso legal

- Esta é uma implementação não oficial e não é afiliada aos autores/mantenedores originais. Se algo estiver inadequado, entre em contato.
