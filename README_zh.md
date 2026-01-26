# DeerFlow TS（非官方）

> 本项目是对字节跳动开源项目 **DeerFlow** 的 TypeScript 重写与接口兼容实现，目标是让原版 Web UI 在不改/少改的情况下，切换到 TS 服务端。

- 原版（致敬）：https://github.com/bytedance/deer-flow
- 本仓库定位：面向工程化与可维护性的 TS 端实现，逐步补齐原版能力

## 现状（已实现）

- 基础服务端：Fastify + TypeScript（ESM），SSE 流式接口 `/api/chat/stream`
- 配置接口：`/api/config`（包含 models 与 rag.provider）
- 本地 RAG（最小可用闭环）
  - 上传：`POST /api/rag/upload`（仅支持 `.md`/`.txt`）
  - 列表/搜索：`GET /api/rag/resources?query=`
  - 解析：当资源为 `rag://local/<file>` 时，检索阶段会读取 `data/rag/<file>` 的内容片段注入到工作流中
- MCP（占位兼容）：`POST /api/mcp/server/metadata`（用于前端配置页联调）

> 说明：整体仍处于“复刻进行中”，目前优先保证前端可用与链路闭环。

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

- `PORT`：后端端口（默认 8000）
- `ALLOWED_ORIGINS`：CORS 白名单（默认 `http://localhost:3000,http://127.0.0.1:3000`）
- `RAG_PROVIDER`：RAG provider（未设置时默认 `local`）
- `ENABLE_MCP_SERVER_CONFIGURATION`：是否启用 MCP 配置能力（默认 false；dev 脚本会开启）

## Roadmap（计划）

- 更完整的 RAG：分段、索引、向量检索/重排，资源管理（删除/重命名/下载）
- 更完整的 MCP：工具发现、工具调用与 workflow 深度集成
- 与原版 API 的更多兼容项（评测、播客、prompt enhancer 等）
- README 英文版与多语言文档补全

## 免责声明

- 本项目为非官方实现，与原版项目作者/维护者无直接关联；如有侵权或不当之处请联系我处理。
