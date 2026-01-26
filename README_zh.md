# DeerFlow TS（非官方）

> 本项目是对字节跳动开源项目 **DeerFlow** 的 TypeScript 重写与接口兼容实现，目标是让原版 Web UI 在不改/少改的情况下，切换到 TS 服务端。

- 原版（致敬）：https://github.com/bytedance/deer-flow
- 本仓库定位：面向工程化与可维护性的 TS 端实现，逐步补齐原版能力

## 现状（能力概览）

- 服务端与协议
  - Fastify + TypeScript（ESM）
  - SSE 流式接口：`POST /api/chat/stream`
  - 配置接口：`GET /api/config`（返回 models 与 rag.provider）
- 多智能体工作流（Planning + Research）
  - Coordinator：判断闲聊直答或进入研究链路
  - Planner：生成结构化研究计划（支持人类反馈编辑 / 自动接受）
  - Researcher：执行检索（本地 RAG / 可选 Web Search）并沉淀 Observations
  - Reporter：基于计划与观察生成最终 Markdown 报告（支持 report style）
- 本地 RAG（最小可用闭环）
  - 上传：`POST /api/rag/upload`（仅支持 `.md`/`.txt`）
  - 列表/搜索：`GET /api/rag/resources?query=`
  - 引用方式：输入框通过 `@` 选择资源，资源 URI 为 `rag://local/<file>`
  - 检索注入：检索阶段读取 `data/rag/<file>` 内容片段并注入到工作流
- Web Search（可选）
  - 已接入 Tavily（设置 `TAVILY_API_KEY` 后启用）
  - 可通过前端开关 `enable_web_search` 控制是否使用
- MCP（占位兼容）
  - `POST /api/mcp/server/metadata`（用于前端配置页联调）

> 说明：整体仍处于“复刻进行中”，当前优先保证前端可用、核心链路闭环与接口兼容性。

## 快速开始

### 环境要求

- Node.js >= 20

### 安装依赖

在仓库根目录：

```bash
npm install
```

前端依赖在 `web/` 下（首次需要安装一次）：

```bash
cd web
npm install
```

### 环境配置（.env）

本项目默认从仓库根目录的 `.env` 读取配置（服务端通过 `dotenv`，前端 dev 也会通过 `dotenv -f ../.env` 注入）。

建议先从示例文件开始：

```bash
cp .env.example .env
```

然后至少补齐一个可用的 LLM 配置（示例）：

```ini
BASIC_MODEL__MODEL=
BASIC_MODEL__API_KEY=
# BASIC_MODEL__BASE_URL=https://api.openai.com/v1
```

> 注意：`.env` 通常包含密钥信息，请勿提交到公开仓库。

### 启动（推荐，一键前后端）

```bash
npm run dev:all
```

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`

### 分别启动

```bash
npm run dev:server
npm run dev:web
```

## 目录结构

- `src/server/`：TS 后端实现
- `data/rag/`：本地 RAG 文件存储目录（上传后会落到这里）
- `web/`：原版 Web UI（作为兼容性目标）

## 常用配置（环境变量）

- `NEXT_PUBLIC_API_URL`：前端请求后端的 API 地址（例如 `http://localhost:8000/api`）
- `PORT`：后端端口（默认 8000）
- `ALLOWED_ORIGINS`：CORS 白名单（默认 `http://localhost:3000,http://127.0.0.1:3000`）
- `RAG_PROVIDER`：RAG provider（未设置时默认 `local`）
- `ENABLE_MCP_SERVER_CONFIGURATION`：是否启用 MCP 配置能力（默认 false；`npm run dev:server` / `dev:all` 会开启）
- `BASIC_MODEL__*` / `REASONING_MODEL__*`：模型配置（最少需要 `BASIC_MODEL__model` 与 `BASIC_MODEL__api_key`）
- `TAVILY_API_KEY`：启用 Web Search（未设置则自动降级为“无网页搜索”）

## Roadmap（计划）

- 更完整的 RAG：分段、索引、向量检索/重排，资源管理（删除/重命名/下载）
- 更完整的 MCP：工具发现、工具调用与 workflow 深度集成
- 与原版 API 的更多兼容项（评测、播客、prompt enhancer 等）
- README 英文版与多语言文档补全

## 免责声明

- 本项目为非官方实现，与原版项目作者/维护者无直接关联；如有侵权或不当之处请联系我处理。
