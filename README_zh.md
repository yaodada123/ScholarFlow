# ScholarFlow：学术研究多智能体 Agent

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | [Deutsch](./README_de.md) | [Español](./README_es.md) | [Русский](./README_ru.md) | [Portuguese](./README_pt.md)

**ScholarFlow** 是一个面向课题方向生成与学术调研报告的多智能体 Research Agent，基于 TypeScript、Fastify、LangGraph 和 Next.js 构建。

它可以将用户的宽泛兴趣或研究问题转化为具体课题方向，结合本地论文/笔记/课程资料、arXiv、OpenAlex 和可选 Web Search 检索证据，并最终生成、评估和编辑结构化 Markdown 调研报告。项目重点不是做一个通用聊天机器人，而是构建一个可规划、可检索、可追踪、可人工干预的学术研究工作流。

## 演示

### 视频

<https://github.com/user-attachments/assets/ca57489b-4022-434e-98b0-ac593f1b55f8>

## 现状（能力概览）

- 课题方向研究工作流
  - Coordinator：判断直接回复或进入学术研究链路
  - Planner：生成候选课题方向、研究问题、可行性、创新性和证据计划
  - Human Feedback：用户可在执行前审阅、接受或编辑研究计划
  - Researcher：检索本地论文/笔记、免费学术搜索结果和可选 Web 证据
  - Reporter：基于计划、证据和来源生成结构化 Markdown 调研报告
- 学术证据检索
  - 本地 RAG：上传 Markdown/TXT 论文、笔记或课程资料，并通过 `@` 引用
  - 免费学术搜索：接入 arXiv + OpenAlex，获取论文标题、作者、年份、DOI、概念标签和引用数
  - 可选 Web Search：设置 `TAVILY_API_KEY` 后启用 Tavily
- 报告优化与质量闭环
  - Prompt 增强：`POST /api/prompt/enhance`
  - 报告质量评估：`POST /api/report/evaluate`，支持自动指标和可选 LLM-as-Judge
  - 编辑器 AI 改写/续写：`POST /api/prose/generate`
  - 支持报告导出和本地图片上传
- 服务端与协议
  - Fastify + TypeScript（ESM）
  - SSE 流式接口：`POST /api/chat/stream`
  - 配置接口：`GET /api/config`（返回 models 与 rag.provider）
- MCP 与 Podcast
  - MCP metadata 接口已用于设置页联调，但完整工具发现/执行尚未启用
  - Podcast/TTS 接口会返回明确的未启用响应，待配置 TTS provider 后扩展

> 说明：当前版本优先跑通“课题方向生成、证据检索、综合成文、质量评估、编辑优化”的学术调研闭环。更强的引用溯源、PDF 解析、向量 RAG 和完整 MCP 工具执行属于后续增强方向。

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

然后至少补齐一个 OpenAI-compatible LLM 配置。DeepSeek 示例：

```ini
BASIC_MODEL__MODEL=deepseek-chat
BASIC_MODEL__API_KEY=sk-your-deepseek-api-key
BASIC_MODEL__BASE_URL=https://api.deepseek.com

# 可选：深度思考模式使用
# REASONING_MODEL__MODEL=deepseek-reasoner
# REASONING_MODEL__API_KEY=sk-your-deepseek-api-key
# REASONING_MODEL__BASE_URL=https://api.deepseek.com
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
- 更多学术搜索集成：Semantic Scholar、CrossRef、BibTeX 工作流
- 更强的评估体系：计划质量、证据覆盖、引用准确性和幻觉风险评估
- 完整 MCP 工具发现、安全执行与 workflow 集成
- 可选 TTS provider 集成，用于播客/音频报告生成

## 致谢

ScholarFlow 受到 Deep Research 类 Agent 和开源 LLM 生态的启发，项目重点是用 TypeScript 工程化实现一个面向学术研究场景的可控多智能体工作流。
