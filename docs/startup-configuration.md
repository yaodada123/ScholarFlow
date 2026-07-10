# ScholarFlow 启动配置手册

本文档说明 ScholarFlow 的本地启动方式和可选环境配置。项目由两部分组成：

- 后端：Fastify 服务，默认监听 `8899`，API 前缀为 `/api`。
- 前端：Next.js 应用，默认监听 `3300`。

配置文件统一放在仓库根目录 `.env`。后端通过 `dotenv` 读取根目录 `.env`，前端开发命令也会通过 `dotenv -f ../.env` 注入同一份配置。

## 1. 最小可启动配置

### 1.1 安装依赖

在仓库根目录安装后端依赖：

```bash
npm install
```

安装前端依赖：

```bash
npm --prefix web install
```

### 1.2 创建 `.env`

从示例文件复制：

```bash
cp .env.example .env
```

### 1.3 配置基础模型

完整聊天、规划和报告生成至少需要配置 `BASIC_MODEL__MODEL` 和 `BASIC_MODEL__API_KEY`。`BASIC_MODEL__BASE_URL` 用于 OpenAI-compatible provider。

DeepSeek 示例：

```ini
BASIC_MODEL__MODEL=deepseek-chat
BASIC_MODEL__API_KEY=sk-your-deepseek-api-key
BASIC_MODEL__BASE_URL=https://api.deepseek.com
BASIC_MODEL__TEMPERATURE=0.3
BASIC_MODEL__MAX_TOKENS=8192
BASIC_MODEL__TIMEOUT_MS=120000
```

如果没有配置基础模型，服务仍可启动，但完整 LLM 工作流会返回“请配置 `BASIC_MODEL__MODEL` 和 `BASIC_MODEL__API_KEY`”之类的降级提示。

## 2. 启动命令

### 2.1 推荐：一键启动前后端

```bash
npm run dev:all
```

该命令会同时运行：

- `npm run dev:server`：后端 `http://localhost:8899`
- `npm run dev:web`：前端 `http://localhost:3300`

### 2.2 分别启动

后端：

```bash
npm run dev:server
```

前端：

```bash
npm run dev:web
```

### 2.3 构建与生产启动

后端构建：

```bash
npm run build
npm run start
```

前端构建：

```bash
npm --prefix web run build
npm --prefix web run start
```

生产启动时需要确保 `.env` 中的端口、API 地址、模型密钥与部署环境一致。

## 3. 端口、API 地址与跨域

| 变量 | 必需 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `PORT` | 否 | `8899` | 后端监听端口。 |
| `ALLOWED_ORIGINS` | 否 | `http://localhost:3300,http://127.0.0.1:3300` | 后端 CORS 白名单，多个 origin 用英文逗号分隔。 |
| `NEXT_PUBLIC_API_URL` | 否 | 按当前前端 host 推导到 `:8899/api/` | 前端请求后端 API 的基础地址。显式配置时建议以 `/api` 结尾。 |

本地默认配置：

```ini
PORT=8899
ALLOWED_ORIGINS=http://localhost:3300,http://127.0.0.1:3300
NEXT_PUBLIC_API_URL=http://localhost:8899/api
```

如果修改前端端口，需要同步更新 `ALLOWED_ORIGINS`。如果修改后端端口，需要同步更新 `NEXT_PUBLIC_API_URL`。

## 4. 模型配置

模型变量采用 `<TYPE>_MODEL__<KEY>` 格式，当前支持的 `TYPE` 包括：

- `BASIC`：默认聊天、规划、研究和报告生成使用。
- `REASONING`：前端设置中开启深度思考时使用。
- `VISION`：预留给视觉模型能力。
- `CODE`：预留给代码模型能力。

支持的字段：

| 字段 | 说明 |
| --- | --- |
| `MODEL` | 模型名。缺失时该类型模型视为未配置。 |
| `API_KEY` | provider 密钥。多数 OpenAI-compatible provider 必填。 |
| `BASE_URL` / `API_BASE` | provider API 根地址。 |
| `TEMPERATURE` | 采样温度。 |
| `MAX_TOKENS` | 单次响应最大 token 数。 |
| `TIMEOUT_MS` / `TIMEOUT` | 请求超时时间，单位毫秒。 |

可选深度思考示例：

```ini
REASONING_MODEL__MODEL=deepseek-reasoner
REASONING_MODEL__API_KEY=sk-your-deepseek-api-key
REASONING_MODEL__BASE_URL=https://api.deepseek.com
REASONING_MODEL__TEMPERATURE=0.3
REASONING_MODEL__MAX_TOKENS=8192
REASONING_MODEL__TIMEOUT_MS=180000
```

## 5. RAG 与资料上传配置

ScholarFlow 支持本地资料检索和 LanceDB 向量检索两种模式。

### 5.1 本地 RAG（默认）

```ini
RAG_PROVIDER=local
```

该模式会读取上传到 `data/rag/` 的资源文本，并在工作流中提供本地资料摘录。适合最小启动，不需要 embedding 模型。

### 5.2 LanceDB 向量 RAG（可选）

启用向量检索：

```ini
RAG_PROVIDER=lancedb
LANCEDB_URI=data/lancedb
LANCEDB_TABLE=rag_chunks
RAG_CHUNK_SIZE=1200
RAG_CHUNK_OVERLAP=200
RAG_MAX_CONTEXT_CHARS=12000
```

启用 LanceDB 时，还需要配置 embedding 模型：

```ini
EMBEDDING_MODEL__MODEL=text-embedding-3-small
EMBEDDING_MODEL__API_KEY=sk-your-api-key
EMBEDDING_MODEL__BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL__TIMEOUT_MS=60000
EMBEDDING_MODEL__BATCH_SIZE=64
EMBEDDING_MODEL__DIMENSIONS=1536
```

LanceDB 索引是增强能力：索引失败时，系统应尽量保留本地摘录检索能力，避免阻断基础流程。

### 5.3 上传资源限制

当前资料上传主要面向文本类学术材料：

- 支持：`.md`、`.txt`、`.pdf`。
- 上传目录：`data/rag/`。
- 文件名会在后端写入前做安全清理。

扫描版或图片型 PDF 默认不会做 OCR。需要 OCR 时可启用：

```ini
PDF_OCR_ENABLED=true
PDF_OCR_LANG=eng+chi_sim
PDF_OCR_MAX_PAGES=20
PDF_OCR_DESIRED_WIDTH=1600
```

OCR 会增加处理时间，并依赖运行环境具备相应的 PDF/OCR 工具链。

## 6. 可选能力配置

### 6.1 Web Search

```ini
TAVILY_API_KEY=tvly-your-api-key
```

设置后启用 Tavily 网页搜索。未设置时，网页搜索会自动降级为无结果，不影响本地资料和基础聊天启动。

### 6.2 MCP 配置入口

```ini
ENABLE_MCP_SERVER_CONFIGURATION=true
```

该变量启用 `/api/mcp/server/metadata` 元数据接口，前端设置页可用它探测 MCP server 工具信息。注意：MCP 配置入口不等同于完整 MCP 工具执行能力。

`npm run dev:server` 和 `npm run dev:all` 会在命令行里默认注入 `ENABLE_MCP_SERVER_CONFIGURATION=true`。

### 6.3 前端静态模式与流式缓冲

```ini
NEXT_PUBLIC_STATIC_WEBSITE_ONLY=false
NEXT_PUBLIC_MAX_STREAM_BUFFER_SIZE=1048576
```

- `NEXT_PUBLIC_STATIC_WEBSITE_ONLY=true`：前端进入静态/回放导向模式，适合不连接后端的展示场景。
- `NEXT_PUBLIC_MAX_STREAM_BUFFER_SIZE`：控制 SSE 流解析允许的最大缓冲区大小。报告或工具输出特别长时可以适当增大。

### 6.4 Langfuse 观测

本地试用 Langfuse 推荐使用官方 Docker Compose。为避免和其他本地服务冲突，ScholarFlow 约定本地 Langfuse Web 入口使用 `http://localhost:3090`。

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse
```

编辑 Langfuse 仓库里的 `docker-compose.yml`，把 Web 服务从宿主机 `3000` 改到 `3090`：

```yaml
environment:
  NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3090}

langfuse-web:
  ports:
    - 3090:3000
```

同时把 compose 文件中标记为 `CHANGEME` 的 secret 换成你本地生成的值，至少建议替换 `ENCRYPTION_KEY` 和 `NEXTAUTH_SECRET`：

```bash
openssl rand -hex 32     # 可用作 ENCRYPTION_KEY
openssl rand -base64 32  # 可用作 NEXTAUTH_SECRET
```

启动 Langfuse：

```bash
docker compose up -d
docker compose logs -f langfuse-web
```

启动完成后打开 `http://localhost:3090`，注册/登录并创建 project，在 project settings 中复制 public key 和 secret key。然后回到 ScholarFlow 根目录的 `.env` 中配置：

```ini
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=http://localhost:3090
```

重启 ScholarFlow 后端后验证：

```bash
npm run dev:server
curl http://localhost:8899/api/config | jq '.observability'
```

预期返回：

```json
{ "langfuse_enabled": true }
```

配置后 chat 和 research workflow 会把远端 trace 写入 Langfuse；未配置时不影响本地 JSONL trace，项目仍会把本地 trace 写入 `data/traces/`。

### 6.5 前端 GitHub / Analytics

```ini
GITHUB_OAUTH_TOKEN=
AMPLITUDE_API_KEY=
```

这两个变量是前端相关的可选集成。普通本地开发不需要配置。

## 7. 常见启动场景

### 7.1 最小聊天与报告生成

```ini
NEXT_PUBLIC_API_URL=http://localhost:8899/api
PORT=8899
ALLOWED_ORIGINS=http://localhost:3300,http://127.0.0.1:3300
RAG_PROVIDER=local

BASIC_MODEL__MODEL=deepseek-chat
BASIC_MODEL__API_KEY=sk-your-deepseek-api-key
BASIC_MODEL__BASE_URL=https://api.deepseek.com
```

适合第一次启动和普通开发。

### 7.2 启用深度思考

在最小配置基础上增加：

```ini
REASONING_MODEL__MODEL=deepseek-reasoner
REASONING_MODEL__API_KEY=sk-your-deepseek-api-key
REASONING_MODEL__BASE_URL=https://api.deepseek.com
```

适合需要更强规划/推理质量的研究任务。

### 7.3 启用网页搜索

在最小配置基础上增加：

```ini
TAVILY_API_KEY=tvly-your-api-key
```

适合需要外部网页证据补充的调研任务。

### 7.4 启用向量 RAG

在最小配置基础上增加：

```ini
RAG_PROVIDER=lancedb
EMBEDDING_MODEL__MODEL=text-embedding-3-small
EMBEDDING_MODEL__API_KEY=sk-your-api-key
EMBEDDING_MODEL__BASE_URL=https://api.openai.com/v1
```

适合上传资料较多、需要语义检索的场景。

## 8. 常见问题排查

### 前端打不开或端口不对

确认前端命令是：

```bash
npm run dev:web
```

默认地址是 `http://localhost:3300`，不是 `3000`。

### 前端请求后端失败

检查：

```ini
NEXT_PUBLIC_API_URL=http://localhost:8899/api
ALLOWED_ORIGINS=http://localhost:3300,http://127.0.0.1:3300
```

同时确认后端已启动在 `8899`。

### 页面能打开但聊天提示模型未配置

检查 `.env` 中是否至少有：

```ini
BASIC_MODEL__MODEL=...
BASIC_MODEL__API_KEY=...
```

如果 provider 不是默认 OpenAI 地址，也要配置 `BASIC_MODEL__BASE_URL`。

### Web Search 没有结果

检查是否配置 `TAVILY_API_KEY`。未配置时属于预期降级，不是启动失败。

### LanceDB RAG 不生效

检查三类配置：

```ini
RAG_PROVIDER=lancedb
LANCEDB_URI=data/lancedb
EMBEDDING_MODEL__MODEL=...
EMBEDDING_MODEL__API_KEY=...
```

如果 embedding 请求失败，先切回 `RAG_PROVIDER=local` 验证基础上传和摘录流程。

### MCP 设置页接口返回 403

启用：

```ini
ENABLE_MCP_SERVER_CONFIGURATION=true
```

如果通过 `npm run dev:server` 或 `npm run dev:all` 启动，该变量会由脚本默认注入。

## 9. 启动前检查清单

- `.env` 已从 `.env.example` 复制并填入真实密钥。
- `BASIC_MODEL__MODEL` 和 `BASIC_MODEL__API_KEY` 已配置。
- 前端访问 `http://localhost:3300`。
- 后端访问 `http://localhost:8899/healthz` 返回 `{ "ok": true }`。
- 修改端口后，`NEXT_PUBLIC_API_URL` 与 `ALLOWED_ORIGINS` 已同步。
- 可选能力按需启用；未配置 Tavily、LanceDB、LangFuse、MCP 不应阻断最小启动。
