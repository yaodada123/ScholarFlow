# 接入 LanceDB 向量 RAG MVP

## Context

当前系统的本地 RAG 只是把用户上传的 Markdown/TXT 文件保存到 `data/rag/`，前端通过 `@` 选择资源后把 `resources` 传给后端，后端在 `src/server/tools/resources.ts` 中按资源标题/URI 做简单字符串匹配，并读取文件开头片段注入 Reporter prompt。这会导致检索只命中文件开头，无法根据用户问题定位中后段相关内容。

本次改造的目标是接入 LanceDB，把本地资料升级为“上传后切 chunk + embedding + 向量检索”，同时保持现有前端 API 和聊天链路不变：`POST /api/rag/upload`、`GET /api/rag/resources`、chat request 的 `resources` 字段以及 Reporter observations 注入方式都继续可用。

## Recommended Approach

### 1. 新增依赖与配置

修改：

- `package.json`
- `package-lock.json`
- `.env.example`

新增依赖：

- `@lancedb/lancedb`

新增环境变量示例：

```env
RAG_PROVIDER=lancedb
LANCEDB_URI=data/lancedb
LANCEDB_TABLE=rag_chunks
RAG_CHUNK_SIZE=1200
RAG_CHUNK_OVERLAP=200
RAG_MAX_CONTEXT_CHARS=12000
EMBEDDING_MODEL__MODEL=text-embedding-3-small
EMBEDDING_MODEL__API_KEY=sk-your-api-key
EMBEDDING_MODEL__BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL__TIMEOUT_MS=60000
EMBEDDING_MODEL__BATCH_SIZE=64
# EMBEDDING_MODEL__DIMENSIONS=1536
```

默认保持 `RAG_PROVIDER=local`，未配置 embedding 或 LanceDB 失败时继续走现有本地片段读取逻辑。

### 2. 增加 embedding 配置和 client

修改：

- `src/server/llm/env-models.ts`

新增：

- `src/server/llm/openai-compatible-embedding.ts`

在 `env-models.ts` 中新增独立的 `loadEmbeddingConfig()`，读取 `EMBEDDING_MODEL__*`，不要影响现有 `loadLlmConfig("basic")` / `loadLlmConfig("reasoning")`。

新增 OpenAI-compatible embedding client，调用 `${baseUrl}/embeddings`，支持：

- 批量 `input`
- `model`
- `apiKey`
- `timeoutMs`
- 可选 `dimensions`
- 按 response `data[].index` 还原顺序

接口建议：

```ts
embedTexts({ texts, signal }): Promise<number[][]>
embedQuery({ text, signal }): Promise<number[]>
```

### 3. 新增 RAG 配置、chunking 和 LanceDB store

新增：

- `src/server/rag/config.ts`
- `src/server/rag/chunk.ts`
- `src/server/rag/lancedb-store.ts`

`config.ts` 负责集中读取：

- `RAG_PROVIDER`
- `LANCEDB_URI`
- `LANCEDB_TABLE`
- `RAG_CHUNK_SIZE`
- `RAG_CHUNK_OVERLAP`
- `RAG_MAX_CONTEXT_CHARS`

`chunk.ts` 先实现字符级 chunking：标准化换行、按段落拼接、超长段落按字符切分、保留 overlap。MVP 不引入 tokenizer。

`lancedb-store.ts` 负责：

- 连接 `data/lancedb`
- 创建/打开 `rag_chunks` 表
- 上传后索引单个本地资源
- 检索前确保历史文件已索引
- 对前端选中的 `resources` 做向量检索
- 将 chunk 聚合回现有 `RetrievedResource` 兼容结构

推荐 row 字段：

```ts
{
  id: string;
  resource_uri: string;
  title: string;
  description: string;
  filename: string;
  chunk_index: number;
  text: string;
  vector: number[];
  content_hash: string;
  file_size: number;
  file_mtime_ms: number;
  indexed_at: string;
}
```

检索必须尊重 chat request 中的 selected `resources`，不能全库返回未被 `@` 选择的文件。优先使用 LanceDB filter/where；如果 JS API 兼容性不足，则 oversample 后在 JS 层按 `resource_uri` 过滤。

### 4. 改造 `retrieveResources` 为 LanceDB 优先、本地 fallback

修改：

- `src/server/tools/resources.ts`

保持现有导出类型和函数签名：

```ts
retrieveResources({ query, resources, limit, maxExcerptChars }): Promise<RetrievedResource[]>
```

把当前逻辑抽成 `retrieveResourcesLocalFallback()`。新的主流程：

1. 如果 `RAG_PROVIDER !== "lancedb"`，走 local fallback。
2. 如果没有 `resources` 或没有 embedding 配置，走 local fallback。
3. 尝试 `searchIndexedResources()`：
   - 对 query 生成 embedding；
   - 确保 selected resources 已索引；
   - LanceDB top-k 检索；
   - 聚合 chunk text 到 `excerpt`；
   - 返回 `RetrievedResource[]`。
4. 如果 LanceDB/embedding 出错或返回空结果，记录 warning 并走 local fallback。

这样 `src/server/chat/run-chat-workflow.ts` 中 researcherNode 的现有调用可以基本不改，Reporter prompt 也会继续通过 observations 获取检索内容。

### 5. 上传成功后同步索引，但索引失败不影响上传

修改：

- `src/server/app.ts`

在 `/api/rag/upload` 中保持现有文件保存流程。`rename(tmpPath, fullPath)` 成功后：

1. 构造 `const resource = buildLocalResource(filename)`。
2. 如果 `RAG_PROVIDER=lancedb`，调用 `indexLocalResource({ filename, uri: resource.uri, title: resource.title, description: resource.description })`。
3. 索引失败时用 `app.log.warn` 记录，仍返回 `resource`。

这样前端 `web/src/app/settings/tabs/rag-tab.tsx` 不需要调整，上传成功仍表示文件已保存；即使 embedding 服务临时不可用，聊天检索还能降级为当前本地 excerpt。

### 6. 前端保持不变

MVP 不修改：

- `web/src/app/settings/tabs/rag-tab.tsx`
- `web/src/components/deer-flow/message-input.tsx`
- `web/src/components/deer-flow/resource-suggestion.tsx`
- `web/src/core/api/rag.ts`
- `web/src/core/store/store.ts`

因为这些契约保持不变：

- `POST /api/rag/upload` 仍接收 multipart file，成功返回 Resource。
- `GET /api/rag/resources` 仍返回 `{ resources }`。
- `Resource` 仍是 `{ uri, title, description? }`。
- chat request 仍携带 `resources`。

不做删除资源、重建索引、索引状态 UI。

## Fallback Requirements

以下情况必须降级到当前本地逻辑，而不是让聊天失败：

- `RAG_PROVIDER=local`
- 未配置 `EMBEDDING_MODEL__MODEL`
- embedding API 失败或超时
- LanceDB 连接/建表/查询失败
- embedding 维度和已有 LanceDB 表不一致
- 历史文件懒索引失败
- 向量检索无结果
- 文件为空或 chunk 为空

上传接口也不应因为索引失败返回失败，除非文件保存本身失败。

## Verification

1. 安装依赖后运行：

```bash
npm run typecheck
npm run build
```

2. local fallback 验证：

- 设置 `RAG_PROVIDER=local`。
- 上传 `.md` / `.txt`。
- 前端 `@` 选择该资源并发起 chat。
- 确认行为与当前一致，Reporter 能看到本地文件 excerpt。

3. LanceDB 正常路径验证：

- 设置 `RAG_PROVIDER=lancedb` 和 `EMBEDDING_MODEL__*`。
- 上传包含多个主题段落的 `.md`。
- 询问文件中后段相关问题，并 `@` 选择该资源。
- 确认返回的 `Retrieved resources` 更接近 query，而不是只包含文件开头。

4. 历史文件懒索引验证：

- 手动把 `.md` / `.txt` 放入 `data/rag/`。
- 不走上传接口，直接在前端 `@` 选择并发起 chat。
- 确认检索时会尝试索引；失败时仍 fallback。

5. embedding 失败验证：

- 配置错误 API key。
- 上传和 chat 都不应失败。
- 日志出现 warning，Reporter 仍使用 local fallback excerpt。

6. 重复上传同名文件验证：

- 上传 `a.md` 主题 A，检索主题 A。
- 重新上传同名 `a.md` 主题 B，检索主题 B。
- 确认旧 chunk 不污染新结果；如果污染，修正按 `resource_uri` / `content_hash` 清理旧 rows 的逻辑。

## Critical Files

需要修改：

- `package.json`
- `package-lock.json`
- `.env.example`
- `src/server/llm/env-models.ts`
- `src/server/tools/resources.ts`
- `src/server/app.ts`

需要新增：

- `src/server/llm/openai-compatible-embedding.ts`
- `src/server/rag/config.ts`
- `src/server/rag/chunk.ts`
- `src/server/rag/lancedb-store.ts`

预计无需修改：

- `src/server/chat/run-chat-workflow.ts`
- `src/server/workflow.ts`
- `src/server/schemas.ts`
- `web/src/**`
