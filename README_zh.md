# ScholarFlow：学术研究多智能体 Agent

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

**ScholarFlow** 是一个面向学术研究场景的多智能体 Research Agent，基于 TypeScript、Fastify、LangGraph 和 Next.js 构建。

它可以将用户的研究问题转化为结构化研究计划，结合本地论文/笔记/课程资料和可选 Web Search 检索证据，并最终生成结构化 Markdown 研究报告。项目重点不是做一个通用聊天机器人，而是构建一个可规划、可检索、可追踪、可人工干预的学术研究工作流。

## 演示

### 视频

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## 现状（能力概览）

- 学术研究工作流
  - Coordinator：判断直接回复或进入学术研究链路
  - Planner：根据研究问题生成结构化研究计划
  - Human Feedback：用户可在执行前审阅、接受或编辑研究计划
  - Researcher：检索本地论文/笔记资料和可选 Web 证据，并沉淀 Observations
  - Reporter：基于计划、证据和来源生成结构化 Markdown 研究报告
- 服务端与协议
  - Fastify + TypeScript（ESM）
  - SSE 流式接口：`POST /api/chat/stream`
  - 配置接口：`GET /api/config`（返回 models 与 rag.provider）
- 本地学术 RAG（最小可用闭环）
  - 上传：`POST /api/rag/upload`（仅支持 `.md`/`.txt`）
  - 列表/搜索：`GET /api/rag/resources?query=`
  - 引用方式：输入框通过 `@` 选择论文、笔记或研究资料
  - 资源 URI：`rag://local/<file>`
  - 检索注入：研究阶段读取 `data/rag/<file>` 内容片段并注入到工作流
- Web Search（可选）
  - 已接入 Tavily（设置 `TAVILY_API_KEY` 后启用）
  - 可通过前端开关 `enable_web_search` 控制是否使用
- MCP（配置占位）
  - `POST /api/mcp/server/metadata`（用于前端配置页联调）

> 说明：当前版本优先跑通“规划、检索、综合、报告”的学术研究闭环。RAG 质量、引用溯源和外部学术搜索工具属于后续增强方向。

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

- `src/server/`：TypeScript 后端与学术研究工作流实现
- `data/rag/`：本地学术资料存储目录（上传后的 Markdown/TXT 文件会落到这里）
- `web/`：Next.js 前端界面
- `docs/academic-agent-interview-packaging.md`：面试项目定位与讲解话术

## 常用配置（环境变量）

- `NEXT_PUBLIC_API_URL`：前端请求后端的 API 地址（例如 `http://localhost:8000/api`）
- `PORT`：后端端口（默认 8000）
- `ALLOWED_ORIGINS`：CORS 白名单（默认 `http://localhost:3000,http://127.0.0.1:3000`）
- `RAG_PROVIDER`：RAG provider（未设置时默认 `local`）
- `ENABLE_MCP_SERVER_CONFIGURATION`：是否启用 MCP 配置能力（默认 false；`npm run dev:server` / `dev:all` 会开启）
- `BASIC_MODEL__*` / `REASONING_MODEL__*`：模型配置（最少需要 `BASIC_MODEL__MODEL` 与 `BASIC_MODEL__API_KEY`）
- `TAVILY_API_KEY`：启用 Web Search（未设置则自动降级为无网页搜索）

## Roadmap（计划）

- 学术 RAG 增强：分段、索引、向量检索、重排和 metadata 过滤
- PDF 论文解析、章节感知切分和参考文献抽取
- Citation Grounding：将报告中的关键结论绑定到具体资料片段
- 学术搜索工具：arXiv、Semantic Scholar、CrossRef、BibTeX 工作流
- 评估体系：计划质量、证据覆盖、引用准确性和幻觉风险评估
- 更完整的 MCP 工具发现与 workflow 集成

## 致谢

ScholarFlow 受到 Deep Research 类 Agent 和开源 LLM 生态的启发，项目重点是用 TypeScript 工程化实现一个面向学术研究场景的可控多智能体工作流。
