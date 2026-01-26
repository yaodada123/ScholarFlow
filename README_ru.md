# DeerFlow TS (Неофициально)

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

Этот репозиторий — **неофициальная TypeScript‑реализация** оригинального **DeerFlow** (ByteDance). Цель — сохранить совместимость с существующим Web UI и перенести серверную часть на TypeScript.

- Оригинальный проект (благодарности): https://github.com/bytedance/deer-flow

## Демонстрация

### Видео

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## Текущее состояние (возможности)

- Сервер и протокол
  - Fastify + TypeScript (ESM)
  - SSE‑стриминг: `POST /api/chat/stream`
  - Конфигурация: `GET /api/config` (возвращает models и `rag.provider`)
- Мультиагентный workflow (Planning + Research)
  - Coordinator: решает — прямой чат или исследовательский workflow
  - Planner: строит структурированный план исследования (поддерживает правки через human feedback / авто‑принятие)
  - Researcher: выполняет retrieval (локальный RAG / опциональный Web Search) и накапливает Observations
  - Reporter: генерирует финальный Markdown‑отчёт по плану и наблюдениям (поддерживает report style)
- Локальный RAG (минимально рабочий цикл)
  - Загрузка: `POST /api/rag/upload` (только `.md` / `.txt`)
  - Список/поиск: `GET /api/rag/resources?query=`
  - Ссылка: выбор ресурсов через `@` в поле ввода, URI `rag://local/<file>`
  - Инъекция в retrieval: читает фрагменты из `data/rag/<file>` и инъектирует в workflow
- Web Search (опционально)
  - Интегрирован Tavily (включается при наличии `TAVILY_API_KEY`)
  - Управляется переключателем фронтенда `enable_web_search`
- MCP (плейсхолдер совместимости)
  - `POST /api/mcp/server/metadata` (для страницы настроек фронтенда)

> Примечание: проект всё ещё “WIP”. Сейчас приоритет — совместимость с Web UI и замкнутый основной workflow.

## Быстрый старт

### Требования

- Node.js >= 20

### Установка зависимостей

В корне репозитория:

```bash
npm install
```

Зависимости фронтенда находятся в `web/` (установить один раз):

```bash
cd web
npm install
```

### Окружение (.env)

По умолчанию проект читает `.env` из корня (server через `dotenv`, frontend dev через `dotenv -f ../.env`).

Начните с примера:

```bash
cp .env.example .env
```

Затем заполните хотя бы одну рабочую конфигурацию LLM (пример):

```ini
BASIC_MODEL__MODEL=
BASIC_MODEL__API_KEY=
# BASIC_MODEL__BASE_URL=https://api.openai.com/v1
```

> Примечание: `.env` обычно содержит секреты. Не коммитьте в публичный репозиторий.

### Запуск (рекомендуется, одной командой)

```bash
npm run dev:all
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Запуск отдельно

```bash
npm run dev:server
npm run dev:web
```

## Структура проекта

- `src/server/`: TypeScript‑бэкенд
- `data/rag/`: локальное хранилище файлов RAG (загрузки попадают сюда)
- `web/`: оригинальный Web UI (цель по совместимости)

## Часто используемые настройки (переменные окружения)

- `NEXT_PUBLIC_API_URL`: base URL API для фронтенда (например `http://localhost:8000/api`)
- `PORT`: порт бэкенда (по умолчанию 8000)
- `ALLOWED_ORIGINS`: CORS allowlist (по умолчанию `http://localhost:3000,http://127.0.0.1:3000`)
- `RAG_PROVIDER`: RAG provider (если не задано => `local`)
- `ENABLE_MCP_SERVER_CONFIGURATION`: включить конфигурацию MCP (по умолчанию false; включается `npm run dev:server` / `dev:all`)
- `BASIC_MODEL__*` / `REASONING_MODEL__*`: конфигурация моделей (минимум: `BASIC_MODEL__MODEL` и `BASIC_MODEL__API_KEY`)
- `TAVILY_API_KEY`: включить Web Search (нет key => автоматически выключено)

## Roadmap

- Более полный RAG: чанкинг, индексация, векторный retrieval/reranking, управление ресурсами (delete/rename/download)
- Более полный MCP: discovery инструментов, вызов инструментов, более глубокая интеграция в workflow
- Больше совместимости API с оригиналом (evaluation, podcast, prompt enhancer и т.д.)
- Улучшить английскую документацию и добавить больше переводов

## Отказ от ответственности

- Это неофициальная реализация и она не связана с авторами/мейнтейнерами оригинального проекта. Если что-то неуместно, свяжитесь со мной.
