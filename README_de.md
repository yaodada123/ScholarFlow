# DeerFlow TS (Inoffiziell)

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

Dieses Repository ist eine **inoffizielle TypeScript-Neuimplementierung** des ursprünglichen **DeerFlow** (von ByteDance). Ziel ist es, die Web UI möglichst kompatibel zu halten, während der Server nach TypeScript migriert wird.

- Originalprojekt (Credits): https://github.com/bytedance/deer-flow

## Demo

### Video

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## Aktueller Stand (Fähigkeiten)

- Server & Protokoll
  - Fastify + TypeScript (ESM)
  - SSE-Streaming-Endpunkt: `POST /api/chat/stream`
  - Konfigurations-Endpunkt: `GET /api/config` (liefert models und `rag.provider`)
- Multi-Agent-Workflow (Planning + Research)
  - Coordinator: entscheidet zwischen direktem Chat und Research-Workflow
  - Planner: erstellt einen strukturierten Research-Plan (mit Human-Feedback-Edits / Auto-Accept)
  - Researcher: führt Retrieval aus (lokales RAG / optional Web Search) und sammelt Observations
  - Reporter: erzeugt den finalen Markdown-Report basierend auf Plan und Observations (mit report style)
- Lokales RAG (minimaler funktionierender Kreislauf)
  - Upload: `POST /api/rag/upload` (nur `.md` / `.txt`)
  - Liste/Suche: `GET /api/rag/resources?query=`
  - Referenz: Ressourcen per `@` im Eingabefeld auswählen, URI-Format `rag://local/<file>`
  - Retrieval-Injection: liest Auszüge aus `data/rag/<file>` und injiziert sie in den Workflow
- Web Search (optional)
  - Tavily integriert (aktiv, wenn `TAVILY_API_KEY` gesetzt ist)
  - Steuerbar über den Frontend-Schalter `enable_web_search`
- MCP (Kompatibilitäts-Platzhalter)
  - `POST /api/mcp/server/metadata` (für die Settings-Seite im Frontend)

> Hinweis: Das Projekt ist weiterhin “WIP”. Aktuell priorisieren wir Web-UI-Kompatibilität und einen geschlossenen Kern-Workflow.

## Schnellstart

### Voraussetzungen

- Node.js >= 20

### Dependencies installieren

Im Repo-Root:

```bash
npm install
```

Frontend-Dependencies liegen unter `web/` (einmalig installieren):

```bash
cd web
npm install
```

### Umgebung (.env)

Standardmäßig wird `.env` aus dem Repo-Root gelesen (Server via `dotenv`, Frontend-dev via `dotenv -f ../.env`).

Starte mit dem Beispiel:

```bash
cp .env.example .env
```

Dann mindestens eine funktionierende LLM-Konfiguration ergänzen (Beispiel):

```ini
BASIC_MODEL__MODEL=
BASIC_MODEL__API_KEY=
# BASIC_MODEL__BASE_URL=https://api.openai.com/v1
```

> Hinweis: `.env` enthält meist Secrets. Bitte nicht in ein öffentliches Repo committen.

### Start (empfohlen, ein Befehl für beides)

```bash
npm run dev:all
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Separat starten

```bash
npm run dev:server
npm run dev:web
```

## Projektstruktur

- `src/server/`: TypeScript-Backend
- `data/rag/`: lokaler RAG-Dateispeicher (Uploads landen hier)
- `web/`: originale Web UI (Kompatibilitätsziel)

## Häufige Konfiguration (Umgebungsvariablen)

- `NEXT_PUBLIC_API_URL`: Frontend API Base URL (z.B. `http://localhost:8000/api`)
- `PORT`: Backend-Port (Default 8000)
- `ALLOWED_ORIGINS`: CORS-Allowlist (Default `http://localhost:3000,http://127.0.0.1:3000`)
- `RAG_PROVIDER`: RAG Provider (wenn nicht gesetzt => `local`)
- `ENABLE_MCP_SERVER_CONFIGURATION`: MCP-Serverkonfiguration (Default false; aktiviert in `npm run dev:server` / `dev:all`)
- `BASIC_MODEL__*` / `REASONING_MODEL__*`: Modellkonfiguration (Minimum: `BASIC_MODEL__MODEL` und `BASIC_MODEL__API_KEY`)
- `TAVILY_API_KEY`: Web Search aktivieren (kein Key => automatisch deaktiviert)

## Roadmap

- Vollständigeres RAG: Chunking, Indexing, Vektor-Retrieval/Reranking, Ressourcenverwaltung (delete/rename/download)
- Vollständigeres MCP: Tool-Discovery, Tool-Calling, tiefere Workflow-Integration
- Mehr API-Kompatibilität zum Original (Evaluation, Podcast, Prompt Enhancer, etc.)
- Englische Dokumentation verbessern und weitere Übersetzungen ergänzen

## Haftungsausschluss

- Dies ist eine inoffizielle Implementierung und steht nicht in Verbindung mit den Original-Autoren/Maintainern. Falls etwas unpassend ist, bitte kontaktieren.
