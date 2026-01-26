# DeerFlow TS (No oficial)

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

Este repositorio es una **reimplementación no oficial en TypeScript** del proyecto original **DeerFlow** (de ByteDance). El objetivo es mantener la compatibilidad con la Web UI existente y migrar el servidor a TypeScript.

- Proyecto original (créditos): https://github.com/bytedance/deer-flow

## Demo

### Vídeo

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## Estado actual (capacidades)

- Servidor y protocolo
  - Fastify + TypeScript (ESM)
  - Endpoint SSE de streaming: `POST /api/chat/stream`
  - Endpoint de configuración: `GET /api/config` (devuelve models y `rag.provider`)
- Flujo multi‑agente (Planning + Research)
  - Coordinator: decide entre chat directo o flujo de investigación
  - Planner: genera un plan de investigación estructurado (soporta edición con feedback humano / auto‑aceptación)
  - Researcher: ejecuta la recuperación (RAG local / Web Search opcional) y acumula Observations
  - Reporter: genera el informe final en Markdown según el plan y las observaciones (soporta report style)
- RAG local (ciclo mínimo funcional)
  - Subida: `POST /api/rag/upload` (solo `.md` / `.txt`)
  - Lista/búsqueda: `GET /api/rag/resources?query=`
  - Referencia: seleccionar recursos con `@` en la caja de entrada, URI `rag://local/<file>`
  - Inyección en recuperación: lee extractos de `data/rag/<file>` e inyecta en el workflow
- Web Search (opcional)
  - Integrado Tavily (habilitado si se configura `TAVILY_API_KEY`)
  - Controlado por el toggle del frontend `enable_web_search`
- MCP (placeholder de compatibilidad)
  - `POST /api/mcp/server/metadata` (para la página de ajustes del frontend)

> Nota: sigue siendo “WIP”. La prioridad actual es la compatibilidad con la Web UI y cerrar el flujo principal.

## Inicio rápido

### Requisitos

- Node.js >= 20

### Instalar dependencias

En la raíz del repositorio:

```bash
npm install
```

Las dependencias del frontend están en `web/` (instalar una vez):

```bash
cd web
npm install
```

### Entorno (.env)

Por defecto se lee `.env` desde la raíz (server via `dotenv`, frontend dev via `dotenv -f ../.env`).

Empieza con el ejemplo:

```bash
cp .env.example .env
```

Luego completa al menos una configuración LLM válida (ejemplo):

```ini
BASIC_MODEL__MODEL=
BASIC_MODEL__API_KEY=
# BASIC_MODEL__BASE_URL=https://api.openai.com/v1
```

> Nota: `.env` suele contener secretos. No lo publiques.

### Arranque (recomendado, un comando para ambos)

```bash
npm run dev:all
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Arranque por separado

```bash
npm run dev:server
npm run dev:web
```

## Estructura del proyecto

- `src/server/`: backend TypeScript
- `data/rag/`: almacenamiento local de archivos RAG (las subidas se guardan aquí)
- `web/`: Web UI original (objetivo de compatibilidad)

## Configuración común (variables de entorno)

- `NEXT_PUBLIC_API_URL`: base URL de la API para el frontend (p.ej. `http://localhost:8000/api`)
- `PORT`: puerto del backend (por defecto 8000)
- `ALLOWED_ORIGINS`: allowlist CORS (por defecto `http://localhost:3000,http://127.0.0.1:3000`)
- `RAG_PROVIDER`: proveedor RAG (si no se define => `local`)
- `ENABLE_MCP_SERVER_CONFIGURATION`: habilitar configuración MCP (por defecto false; habilitado por `npm run dev:server` / `dev:all`)
- `BASIC_MODEL__*` / `REASONING_MODEL__*`: configuración de modelos (mínimo: `BASIC_MODEL__MODEL` y `BASIC_MODEL__API_KEY`)
- `TAVILY_API_KEY`: habilitar Web Search (sin key => deshabilitado automáticamente)

## Roadmap

- RAG más completo: chunking, indexado, recuperación/reranking vectorial, gestión de recursos (delete/rename/download)
- MCP más completo: descubrimiento de herramientas, llamadas de herramientas, integración más profunda en el workflow
- Más compatibilidad de API con el original (evaluación, podcast, prompt enhancer, etc.)
- Mejorar documentación en inglés y añadir más traducciones

## Descargo de responsabilidad

- Esta es una implementación no oficial y no está afiliada a los autores/mantenedores originales. Si algo no es apropiado, contáctame.
