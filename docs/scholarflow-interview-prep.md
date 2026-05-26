# ScholarFlow / Scratch Flow 面试准备手册

> 目标：把这个项目作为面试项目讲清楚。本文从面试官视角拆解可能被问到的问题、考察点、追问方向和参考回答，帮助你提前组织表达。

## 1. 项目一句话定位

ScholarFlow 是一个面向学术研究场景的 AI Research Agent：用户输入研究主题后，系统可以自动规划研究方向、检索本地资料与外部学术信息、生成结构化研究报告，并通过流式事件、执行 Trace 和对话 Replay 保证过程可观察、可复盘。

如果面试官使用 “Scratch Flow” 这个名字，可以这样解释：

> 我把它定位成一个从零搭建的 Research Agent 项目，核心不只是调用大模型生成文本，而是把研究任务拆成规划、检索、证据整理、报告生成、人工反馈和回放复盘几个阶段，重点体现 AI 应用的工程化能力。

## 2. 30 秒自我介绍版

> 这个项目是一个 TypeScript 全栈的学术研究助手。后端用 Fastify 和 LangGraph 风格的工作流组织多个 Agent，包括 planner、researcher、reporter 等；前端用 Next.js 和 Zustand 处理聊天、研究计划、报告和流式状态。它支持本地 RAG、可选 LanceDB 向量检索、arXiv/OpenAlex 学术搜索、Tavily Web Search、SSE 流式响应、Trace 记录和对话 Replay。我的重点不是做一个简单 ChatBot，而是把 Research Agent 的规划、证据、可观测性和可复盘能力完整工程化。

## 3. 2 分钟项目介绍版

> ScholarFlow 是我做的一个面向学术研究的 AI Agent 项目。它解决的问题是：用户在做选题、文献调研和研究报告时，不希望只得到一段泛泛的回答，而是希望看到候选研究方向、研究问题、证据来源、可行性判断、局限性和最终报告。
>
> 架构上，它是 TypeScript 全栈项目。后端是 Fastify，提供 REST 和 SSE 接口；前端是 Next.js 15 / React 19，用 Zustand 管理聊天和研究状态。核心工作流在后端，由 coordinator、planner、researcher、reporter 等角色组成。Research 模式下，系统会先生成计划，必要时进入人工反馈，再执行检索和报告生成；Chat 模式则走更轻量的普通对话流程。
>
> 检索方面，它支持本地上传资料，默认可以做本地文本摘录；如果配置 LanceDB 和 embedding 模型，就会对文档分块、生成向量、写入本地磁盘上的 LanceDB，再做向量检索。外部搜索方面，学术搜索接了 arXiv 和 OpenAlex，Web Search 接 Tavily，并且在没有 key 或失败时可以降级。
>
> 我比较重视工程化能力，所以还做了 Trace 和 Replay。Trace 用来记录一次 workflow 的 span、message、tool call 和 interrupt，方便调试；Replay 则保存完整 ChatEvent 流，用户之后可以像播放录制好的 SSE 一样回放历史对话。这让项目不仅能跑起来，还能定位问题、复盘结果、解释过程。

## 4. 面试官真正想考什么

| 考察维度 | 面试官想确认什么 | 你要主动体现什么 |
| --- | --- | --- |
| 项目理解 | 你是否真的理解项目，而不是只会跑 demo | 能讲清楚业务目标、技术取舍和边界 |
| Agent 架构 | 你是否理解多 Agent / workflow 的必要性 | 为什么拆 planner/researcher/reporter，而不是一个 prompt 解决 |
| 工程落地 | 你是否能把 AI 能力做成稳定产品 | SSE、状态管理、错误降级、配置、Trace、Replay |
| RAG 理解 | 你是否理解 embedding、chunk、向量库、召回 | 能讲清楚 LanceDB 写入和检索流程 |
| 工具调用 | 你是否理解 function call / tool use 的本质 | 能区分原生 function calling 与代码编排的工具事件 |
| 可靠性 | 外部模型、搜索、RAG 失败怎么办 | 可降级、不中断主流程、保留可观测信号 |
| 安全性 | 用户资料、密钥、回放日志怎么保护 | 本地优先、敏感数据不提交、边界校验 |
| 反思能力 | 你知道项目不足和后续改进吗 | 能诚实说 MVP 边界和下一步优化 |

## 5. 高频问题与参考回答

### Q1：这个项目解决了什么问题？为什么不是普通 ChatBot？

**面试官考察点**

- 你是否能从产品价值而不是技术堆栈开始讲。
- 你是否理解 Research Agent 和普通问答的区别。

**参考回答**

普通 ChatBot 更像是直接回答用户问题，但学术研究任务通常需要先拆题、找证据、比较候选方向、形成结构化报告。ScholarFlow 的目标是让用户不仅得到答案，还能看到研究路径：候选主题、研究问题、证据来源、可行性、局限性和最终报告。

所以我把它设计成 Research Agent，而不是单轮 ChatBot。它会先规划，再检索，再写报告，并且把中间过程通过 SSE、Trace 和 Replay 暴露出来，方便用户检查和复盘。

**可能追问**

- “那你觉得它和 ChatGPT/Deep Research 的差异是什么？”
- “如果只是套壳大模型，价值在哪里？”

**追问回答要点**

- 不要说超过成熟产品，而是强调工程实践。
- 重点在：本地资料接入、可配置模型、可观测事件流、可回放、学术证据结构化。

可以回答：

> 我不会说它已经超过成熟产品。这个项目的价值在于我把 Research Agent 的核心链路拆出来并工程化实现了：任务规划、证据检索、报告生成、人工反馈、Trace 和 Replay。它更像是我对 AI Research Agent 架构的一次完整实践。

---

### Q2：整体架构是什么？前后端如何分工？

**参考回答**

项目是 TypeScript 全栈架构：

- 后端：Fastify，负责 API、SSE 流式接口、模型调用、RAG、搜索工具、工作流执行、Trace 和 Replay 保存。
- 前端：Next.js / React，负责聊天界面、研究计划展示、报告展示、设置面板、Replay 播放和状态管理。
- 状态管理：前端用 Zustand 保存 message、research plan、report、activity 等状态。
- 通信方式：普通 REST 用于配置、资源、Trace、Replay 等；聊天主流程通过 SSE 把后端 `ChatEvent` 流式推给前端。

后端不会一次性返回最终结果，而是持续发送事件；前端根据事件类型合并状态，比如 `message_chunk` 合并文本，`tool_calls` 展示工具调用，`tool_call_result` 回填工具结果，`interrupt` 触发人工反馈。

**可能追问**

- “为什么用 SSE，不用 WebSocket？”
- “前端怎么保证流式消息不乱？”

**回答要点**

SSE 适合服务端单向持续推送，聊天生成、工具调用、报告生成都是服务端到客户端的流；实现比 WebSocket 简单，也更贴合 HTTP 请求生命周期。前端通过事件类型和 message id/tool call id 做状态合并，保证不同事件能回到对应消息或研究阶段。

---

### Q3：Agent 工作流是怎么设计的？

**参考回答**

核心分两层：规划阶段和执行阶段。

规划阶段大致是：

```text
coordinator -> background_investigator? -> planner -> human_feedback?
```

执行阶段大致是：

```text
researcher -> reporter
```

- `coordinator` 负责识别任务和组织上下文。
- `background_investigator` 可选，用于补充背景调查。
- `planner` 负责生成研究计划、候选方向、研究问题和证据计划。
- `human_feedback` 允许用户修改计划后再继续。
- `researcher` 根据计划调用本地资料、学术搜索、Web Search 等工具收集证据。
- `reporter` 根据计划、观察结果和来源生成结构化 Markdown 报告。

这样拆分的原因是研究任务不是单次生成，而是有明显阶段：先确定问题，再找证据，再组织报告。拆成多个角色后，每一段职责更清楚，也更容易调试和降级。

**可能追问**

- “为什么不用一个大 prompt 完成？”
- “多 Agent 会不会增加复杂度？”

**回答要点**

会增加复杂度，所以不是为了炫技而拆。拆分的收益是：

1. 每个阶段输出更结构化。
2. 可以在人类反馈点暂停。
3. 工具调用和证据收集更可控。
4. Trace 中能看到哪个阶段失败。
5. 后续可以单独优化 planner、retriever 或 reporter。

---

### Q4：Research 模式和 Chat 模式有什么区别？

**参考回答**

Chat 模式是普通对话，主要目标是快速响应用户问题，不一定执行完整研究流程。

Research 模式会走完整的研究工作流，包括：

1. 生成研究计划。
2. 给出候选研究方向。
3. 收集本地和外部证据。
4. 评估可行性、创新性和局限性。
5. 生成结构化研究报告。

这个区分很重要，因为不是所有用户输入都值得启动复杂流程。普通聊天要低成本、低延迟；研究任务则更强调证据、结构和可追溯性。

---

### Q5：RAG 是怎么实现的？LanceDB 在里面做什么？

**参考回答**

项目支持两种本地资料检索方式：

1. 本地文本摘录 fallback：直接读取上传的 Markdown/TXT 等资源，按关键词或上下文截取片段。
2. LanceDB 向量检索：当 `RAG_PROVIDER=lancedb` 且配置 embedding 模型后，会启用向量检索。

LanceDB 流程大致是：

1. 用户上传资料，服务端保存到本地 `data/rag`。
2. 后端读取文本内容。
3. 按 chunk size 和 overlap 分块。
4. 调用 embedding 模型生成每个 chunk 的向量。
5. 写入 LanceDB 表，字段包括资源 URI、标题、文件名、chunk index、文本、vector、content hash、mtime 等。
6. 查询时，对用户 query 生成 embedding，再在 LanceDB 中做向量相似度检索。
7. 如果 LanceDB 失败或没有结果，降级到本地摘录检索。

LanceDB 是本地磁盘持久化，不是纯内存。默认数据目录类似 `data/lancedb`，所以重启后索引仍然可以保留。

**可能追问**

- “为什么需要 chunk overlap？”
- “如何避免重复索引？”
- “embedding 模型怎么选？”

**回答要点**

- overlap 是为了避免关键信息刚好被切在两个 chunk 边界，提升召回连续语义的能力。
- 可以通过 content hash、文件大小、mtime 等判断资源是否变化，减少重复索引。
- embedding 模型要看维度、语言能力、成本和部署方式；本地可以用 Ollama 的 `nomic-embed-text`，生产可以换成 OpenAI-compatible embedding provider。

---

### Q6：你本地是怎么配置 embedding 和 LanceDB 的？

**参考回答**

我把 embedding 抽象成 OpenAI-compatible `/embeddings` 客户端。这样不同 provider 只要兼容类似接口，就能通过环境变量切换。

本地调试时，我使用 Ollama 跑 embedding 模型，比如 `nomic-embed-text`。配置上主要是：

- `RAG_PROVIDER=lancedb`
- `LANCEDB_URI=data/lancedb`
- `LANCEDB_TABLE=rag_chunks`
- `EMBEDDING_MODEL__MODEL=nomic-embed-text`
- `EMBEDDING_MODEL__BASE_URL=http://localhost:11434/v1`
- `EMBEDDING_MODEL__TIMEOUT_MS=60000`
- `EMBEDDING_MODEL__BATCH_SIZE=16`

面试时不要展示真实 API key。可以只讲变量名和配置思路。

---

### Q7：学术搜索是怎么实现的？

**参考回答**

学术搜索不是直接让 LLM 幻觉文献，而是接了真实外部数据源：

- arXiv：适合预印本论文搜索。
- OpenAlex：覆盖更广的学术作品元数据。

查询时会并行请求两个来源，然后合并结果。合并时会按 DOI 或规范化标题做去重，最后返回限制数量内的结果。这样 reporter 在写报告时可以引用真实来源，而不是编造论文。

**可能追问**

- “为什么不用 Google Scholar？”
- “如何保证论文质量？”

**回答要点**

Google Scholar 没有稳定官方 API，不适合工程集成。OpenAlex 和 arXiv 更开放、可自动化。论文质量不能只靠检索源保证，后续可以增加引用数、年份、venue、相关性 rerank、人工确认等机制。

---

### Q8：Web Search 做了吗？和 Academic Search 有什么区别？

**参考回答**

做了可选 Web Search，使用 Tavily。它和 Academic Search 的定位不同：

- Academic Search：面向论文和学术作品，来源更适合研究证据。
- Web Search：面向互联网网页，适合补充背景、产业动态、最新信息。

如果没有配置 Tavily API Key，Web Search 会降级为空结果，不会破坏整个聊天或研究流程。

---

### Q9：这里是否属于 function call 技术？

**参考回答**

它有 function call / tool use 的思想，但实现方式更偏 workflow-driven tool orchestration。

也就是说，系统里确实有工具调用事件，比如搜索、RAG 检索、学术搜索等；前端也会展示 `tool_calls` 和 `tool_call_result`。但工具是否执行、何时执行，不完全依赖模型原生 function calling 自动决定，而是由后端工作流代码根据研究阶段和计划来编排。

所以我会说：它不是简单的 OpenAI 原生 function calling demo，而是把工具调用作为 Agent workflow 的一部分工程化实现。

**可能追问**

- “那原生 function calling 和你这个有什么差别？”

**回答要点**

原生 function calling 通常是模型输出要调用哪个函数和参数；系统再执行函数并把结果返回给模型。当前项目更强调确定性工作流：planner/researcher/reporter 阶段明确，工具调用由代码框架控制，模型参与生成计划和报告。优点是更可控、可观测；缺点是灵活性可能不如完全自治 Agent。

---

### Q10：SSE 流式事件怎么设计？

**参考回答**

后端 `/api/chat/stream` 不是一次性返回 JSON，而是持续写 SSE。主要事件包括：

- `message_chunk`：模型消息片段或用户 bootstrap 消息。
- `tool_calls`：工具调用开始或工具调用结构。
- `tool_call_chunks`：工具调用参数或过程中的增量片段。
- `tool_call_result`：工具执行结果。
- `interrupt`：需要用户反馈或人工确认的中断点。

前端消费这些事件后，根据事件类型更新 Zustand store。比如文本 chunk 会合并到对应消息，工具结果会根据 `tool_call_id` 找到拥有该工具调用的消息并回填。

**可能追问**

- “如何处理浏览器断开？”
- “如何处理后端异常？”

**回答要点**

后端使用 abort signal 和 close listener 感知连接关闭；异常时发送 error 事件或保留已产生的 partial event log。Replay 和 Trace 的写入失败不应该阻塞主聊天流，但需要留下 warning 便于排查。

---

### Q11：对话回放功能是怎么做的？

**参考回答**

原来项目只有静态 replay：前端读取 `web/public/replay/*.txt` 里的预录制 SSE 文本，然后模拟流式播放。

我扩展成动态 replay：每次真实 `/api/chat/stream` 对话时，后端把完整 `ChatEvent` 流写到本地 JSONL 文件，路径类似：

```text
data/replays/<threadId>/<runId>.jsonl
```

其中 `runId` 复用 TraceRecorder 的 run id，所以 trace 和 replay 可以一一对应。因为真实 SSE 不会把用户消息再发回前端，而普通聊天时用户消息是前端本地 append 的；所以 replay 文件第一条会额外写入一个用户 `message_chunk` bootstrap event，保证回放时能看到完整上下文。

前端新增动态 URL：

```text
/chat?replayThread=<threadId>&replayRun=<runId>
```

进入这个 URL 后，前端调用 replay API 获取事件数组，然后按和静态 replay 类似的节奏逐条播放。

**可能追问**

- “为什么 Replay 不直接复用 Trace？”
- “Replay 会不会有隐私问题？”

**回答要点**

Trace 主要是调试和观测，里面保存 span、preview、tool call 等，不一定完整还原 UI；Replay 要保存完整前端 ChatEvent，所以单独建 event log 更合适。

Replay 的确会保存完整用户输入、模型输出和工具结果，所以必须把 `data/replays` 当作敏感本地数据。生产化要加鉴权、用户隔离、删除接口和 retention 策略，不能随便提交或上传。

---

### Q12：Trace 和 Replay 的区别是什么？

**参考回答**

Trace 和 Replay 都是为了可观测性，但目标不同：

| 能力 | Trace | Replay |
| --- | --- | --- |
| 目标 | 调试和定位 workflow 执行过程 | 完整复现用户看到的聊天事件流 |
| 内容 | span、message preview、tool call、interrupt 等 | 完整 ChatEvent JSONL |
| 使用者 | 开发者 | 用户和开发者 |
| 用途 | 查哪里慢、哪里失败、哪个工具被调用 | 历史对话回放、演示、复盘 |

可以理解为：Trace 是工程调试日志，Replay 是产品级回放记录。

---

### Q13：前端状态管理怎么处理流式消息？

**参考回答**

前端用 Zustand 管理全局聊天和研究状态。状态里有 message ids、messages map、research plan/report/activity 等结构。

当 `sendMessage()` 被触发时：

1. 前端先 append 用户消息。
2. 调用 `chatStream()` 打开 SSE 流。
3. 每收到一个事件，就根据事件类型更新状态。
4. `message_chunk` 合并文本。
5. `tool_call_result` 通过 `tool_call_id` 找到对应工具调用所在消息并填充结果。
6. research 相关事件会更新计划、活动和报告面板。

为了避免历史 replay 和当前聊天混在一起，我还增加了 reset conversation 的能力。点击历史回放前先清空当前聊天和研究派生状态，再跳转到 replay URL。

---

### Q14：如何保证报告里的内容不是模型编造的？

**参考回答**

不能完全靠模型自觉，所以我在 prompt 和数据结构上做约束：

- researcher 先收集 observations 和 sources。
- reporter 只能使用 source registry 中的来源 id。
- 报告要求在证据综述、可行性、候选方向比较等部分用 `[S1]` 这类 source id 标注事实来源。
- 如果没有证据支持，就明确写 evidence gap，而不是编造引用。

这不能 100% 杜绝幻觉，但比直接让模型自由生成更可控。后续可以继续加引用校验、来源可点击、自动检查未引用断言等能力。

---

### Q15：外部工具或模型失败时怎么办？

**参考回答**

项目里我尽量把外部能力设计成可降级：

- Tavily key 缺失时，Web Search 返回空结果。
- LanceDB 检索失败时，降级到本地文本摘录。
- Trace/Replay 写盘失败时，不阻塞主聊天流，但打印 warning。
- LLM 未配置时，返回明确提示，而不是让系统崩溃。

核心原则是：边界能力失败不能破坏整个聊天或研究流程，用户至少要知道哪些能力不可用，开发者也要能从日志或 Trace 中定位问题。

---

### Q16：这个项目的安全风险有哪些？你怎么处理？

**参考回答**

主要风险有四类：

1. API Key 泄露：`.env` 不能提交，示例只能放占位符。
2. 用户资料泄露：上传的资料、RAG 索引、Trace、Replay 都可能包含敏感内容。
3. 路径穿越：上传文件、trace/replay 路径都要做路径片段清洗。
4. 外部服务数据流向：Web Search、模型 provider、embedding provider 都可能接收用户输入或资料片段。

当前项目偏本地优先，数据默认保存在本地 `data/` 下。生产化时还需要加认证授权、用户隔离、数据删除、保留策略和审计。

---

### Q17：如果面试官问“这是你原创的吗？”怎么回答？

**推荐回答**

> 我不会把它包装成完全凭空原创。它参考了成熟 Research Agent 和 Deep Research 类产品的思路，比如规划、检索、报告生成和人工反馈。但我在这个项目里做的是从工程角度重新实现和改造：用 TypeScript 全栈搭建后端 workflow、前端流式 UI、本地 RAG、学术搜索、Trace、Replay 和可配置模型接入。面试中我更想展示的是我对 AI Agent 产品工程化的理解和落地能力。

**不要这样回答**

- “都是我原创的，没有参考任何东西。”
- “我只是 clone 了一个项目跑起来。”

更好的表达是：参考成熟模式，但你理解并实现了关键链路，同时做了自己的增强。

---

### Q18：项目里你最有技术含量的点是什么？

可以选 2-3 个重点讲，不要全部铺开。

**推荐讲法 A：Agent workflow + SSE 工程化**

> 我觉得最核心的是把 Agent 的多阶段过程变成可消费的事件流。后端不是只返回最终文本，而是把 planner、tool call、research activity、report 等过程都通过 SSE 发给前端；前端再做细粒度状态合并。这让用户能看到研究过程，而不是等一个黑盒结果。

**推荐讲法 B：RAG + 证据约束**

> 第二个点是把本地资料和外部学术搜索统一成 evidence source，reporter 写报告时必须引用 source id，减少模型幻觉。

**推荐讲法 C：Trace + Replay**

> 第三个点是可观测和可复盘。Trace 面向开发调试，Replay 面向用户历史回放，这能让 AI 应用从 demo 更接近真实产品。

---

### Q19：你遇到过什么难点？怎么解决？

**参考回答 1：流式状态一致性**

难点是后端事件是增量到达的，但前端要把它们合并成稳定 UI 状态。比如工具调用结果不能随便 append 成新消息，而要找到对应 tool call 所在的消息。解决方式是设计稳定的事件类型和 id 关联规则，在 Zustand store 里集中处理事件合并。

**参考回答 2：RAG 失败降级**

向量检索依赖 embedding 模型和 LanceDB，任何一个环节失败都可能影响检索。我的处理是把 LanceDB 作为增强能力，而不是唯一能力。如果向量检索失败，就回退到本地摘录，保证研究流程还能继续。

**参考回答 3：Replay 完整性**

真实聊天时用户消息是前端本地插入的，不会从后端 SSE 返回。如果直接保存后端事件，回放时会缺用户消息。解决方式是在 replay 文件第一条写入一个用户 `message_chunk` bootstrap event，让回放流变成完整对话。

---

### Q20：你会如何继续优化这个项目？

**参考回答**

我会从四个方向继续优化：

1. **检索质量**：增加 hybrid search、rerank、文献质量评分、引用数/年份/venue 权重。
2. **评估体系**：构建 benchmark，评估报告的引用准确率、证据覆盖率、幻觉率和任务完成度。
3. **生产化安全**：增加用户鉴权、数据隔离、Replay/Trace 删除和 retention、敏感信息脱敏。
4. **交互体验**：让用户可以编辑研究计划、选择证据、对报告段落追问或重写。

回答时可以补一句：

> 我会优先做评估和检索质量，因为 Research Agent 最核心的是可信度，而不是单纯生成更长的文本。

## 6. 深挖题：技术细节版

### 6.1 Embedding 和向量检索

**可能问题**

1. 文档是怎么切 chunk 的？
2. chunk size 和 overlap 怎么选？
3. query embedding 和 document embedding 是否用同一模型？
4. 如果换 embedding 模型，旧索引怎么办？
5. LanceDB 的数据结构是什么？

**回答要点**

- chunk 需要平衡语义完整性和召回粒度。
- overlap 解决边界信息丢失。
- query 和 document 通常要使用同一 embedding 模型，否则向量空间不一致。
- 换 embedding 模型后应该重建索引，至少记录 embedding model/version。
- 当前索引包含 text、vector、resource metadata、content hash、mtime 等字段。

### 6.2 Planner 输出如何稳定？

**可能问题**

1. LLM 输出 JSON 不合法怎么办？
2. plan 字段缺失怎么办？
3. 为什么需要 fallback plan？

**回答要点**

- prompt 要求 planner 只输出 JSON。
- 后端有 safe parse 和 shape validation。
- 如果解析失败或字段缺失，使用 fallback plan 保证流程可继续。
- fallback 不是最佳结果，但能保证系统可靠性和用户可解释反馈。

### 6.3 人工反馈怎么接入？

**可能问题**

1. 用户如何修改计划？
2. interrupt 事件有什么用？
3. 为什么需要 human-in-the-loop？

**回答要点**

- planner 生成计划后，可以通过 interrupt 暂停，让用户确认或修改。
- 用户反馈会进入 planner edit prompt，生成修订后的 plan。
- 学术研究选题很主观，人工反馈能避免 Agent 沿着错误方向继续消耗 token 和搜索资源。

### 6.4 Replay API 如何设计？

**可能问题**

1. 如何列出历史 replay？
2. 如何获取某个 thread 最新 replay？
3. 如果 replay 文件损坏怎么办？
4. 为什么用 JSONL？

**回答要点**

- 后端提供 replays list、thread runs、latest、specific run 等 API。
- JSONL 适合追加写入，流式事件天然一行一个对象。
- 读取时跳过空行和坏 JSON 行，避免一个坏事件破坏整个回放。
- 不存在的 replay 返回 404。

### 6.5 前端 Replay 如何播放？

**可能问题**

1. 静态 replay 和动态 replay 如何兼容？
2. fast-forward 怎么做？
3. 为什么跳转 replay 前要 reset store？

**回答要点**

- 静态 replay 继续读 public fixture；动态 replay 通过 API 拉取 ChatEvent 数组。
- 两者共用事件播放和 timing helper。
- fast-forward 本质是把延迟降为 0 或极小。
- reset store 是为了避免 SPA 内从当前聊天进入历史 replay 时混入旧消息。

## 7. 面试官可能的压力追问

### 追问 1：这个项目现在最大的短板是什么？

**建议回答**

> 最大短板是评估体系还不够完整。虽然我做了证据引用、Trace 和 Replay，但还没有系统化 benchmark 来量化报告质量、引用准确率和幻觉率。如果继续做，我会优先补 evaluation pipeline。

### 追问 2：如果用户上传很大的 PDF 或很多文档怎么办？

**建议回答**

> 目前 MVP 更适合中小规模本地资料。大规模文档需要异步 indexing、任务队列、增量索引、索引状态展示、失败重试和存储清理。向量库层面也要考虑分表、metadata filter 和批量 embedding 成本。

### 追问 3：你怎么证明报告里的引用真的支持结论？

**建议回答**

> 当前做法是约束 reporter 只能引用 source registry，并要求无证据时写 evidence gap。但这还不等于自动证明引用支持结论。下一步可以做 citation verification：把每个 claim 和引用片段再交给 verifier 判断 entailment，或者用规则检查每个事实句是否有 source id。

### 追问 4：如果模型输出恶意内容或 prompt injection 怎么办？

**建议回答**

> 对 RAG 和网页内容要把它们当作不可信输入，不能让检索内容覆盖系统指令。工具结果进入 prompt 时要明确标注为 evidence，不是 instruction。涉及外部链接、脚本或 HTML 时前端也要避免直接渲染不可信内容。

### 追问 5：为什么不用数据库存聊天历史，而是写 JSONL？

**建议回答**

> MVP 阶段 JSONL 更简单，适合 append-only 的事件流，也方便本地调试和回放。生产化可以换成数据库或对象存储，把 event log、metadata、权限和 retention 管起来。当前设计把 replay recorder 封装起来，未来替换存储后端成本相对可控。

### 追问 6：你的 Agent 会不会失控地调用工具？

**建议回答**

> 当前工具调用不是完全自治的无限循环，而是由 workflow 阶段和 max step 等约束控制。这样牺牲了一些灵活性，但提升了可控性和可调试性。后续如果引入更自治的 tool selection，也需要加预算、超时、最大调用次数和安全策略。

### 追问 7：如果多用户同时使用会怎样？

**建议回答**

> 当前更偏本地/单用户开发模式。多用户生产化需要补鉴权、用户级 thread 隔离、data/replays 和 data/traces 的访问控制、并发写入限制、资源配额和清理策略。这个项目现在展示的是核心 Agent 产品链路，生产 SaaS 还需要进一步工程化。

### 追问 8：你最想重构哪里？

**建议回答**

> 我会优先把 workflow event contract 更正式化，比如用共享 schema 或 Zod contract 同时约束后端事件和前端类型。因为 SSE event 是前后端核心协议，一旦字段漂移，UI 状态就容易出问题。

## 8. STAR 项目故事模板

### 故事 1：从 ChatBot 到 Research Agent

- **Situation**：普通问答无法满足学术研究中对证据、结构和可追溯性的需求。
- **Task**：设计一个可以规划、检索、写报告并展示过程的 AI Research Agent。
- **Action**：拆分 planner/researcher/reporter 工作流，引入本地 RAG、学术搜索、Web Search、SSE 流式事件和前端研究面板。
- **Result**：用户可以看到候选选题、研究计划、证据来源和最终报告，而不是只得到一段黑盒回答。

### 故事 2：实现可回放能力

- **Situation**：静态 demo replay 只能播放预录制 fixture，真实用户对话无法复盘。
- **Task**：让每次真实对话自动保存，并可在历史入口中回放。
- **Action**：后端新增 ReplayRecorder，把完整 ChatEvent 写入 JSONL；复用 trace runId；前端新增动态 replay API client、URL 参数解析和历史入口。
- **Result**：真实对话可以保存到本地并按事件流回放，提升演示、调试和复盘能力。

### 故事 3：让 RAG 从本地摘录升级到向量检索

- **Situation**：只做本地文本摘录时，检索语义能力有限。
- **Task**：支持本地向量检索，同时保持失败时可用。
- **Action**：接入 LanceDB，文档分块后调用 embedding 模型生成向量并写入本地磁盘；查询时使用 query embedding 做相似度检索；失败时降级到本地摘录。
- **Result**：在配置 embedding 后可以获得更好的语义召回，同时不牺牲基础可用性。

## 9. 面试表达中的“不要踩坑”

### 不要夸大

不要说：

> 这个系统可以完全自动完成严谨科研。

建议说：

> 它能辅助研究选题和证据整理，但严谨科研仍需要人工判断、引用核验和方法论设计。

### 不要把所有搜索都说成 RAG

RAG 主要指用外部知识检索增强生成。本项目里本地资料检索是 RAG；arXiv/OpenAlex/Tavily 是外部工具搜索，也可以作为 evidence retrieval，但不要混淆概念。

### 不要说 function calling 完全由模型控制

更准确说法是：

> 项目有工具调用事件和 function-call-like 架构，但执行由后端 workflow 编排，更可控。

### 不要暴露密钥

面试展示时只展示 `.env.example` 或变量名，不展示真实 `.env`。

### 不要忽略生产化边界

要主动承认：当前更偏面试项目/MVP，本地优先；生产化需要补鉴权、多用户隔离、数据 retention、CI/CD 和更完整测试。

## 10. 可以主动展示的亮点顺序

如果只有 5 分钟，建议按这个顺序讲：

1. **产品定位**：学术 Research Agent，不是普通 ChatBot。
2. **工作流**：planner/researcher/reporter + human feedback。
3. **证据能力**：本地 RAG + LanceDB + arXiv/OpenAlex + Tavily。
4. **流式体验**：SSE ChatEvent + 前端 Zustand 合并。
5. **可观测与复盘**：Trace + Replay。
6. **可靠性和安全意识**：失败降级、本地敏感数据、密钥保护。

如果只有 2 分钟，保留 1、2、3、5。

## 11. 模拟面试脚本

**面试官**：你这个项目是做什么的？

**你**：这是一个面向学术研究的 AI Research Agent。用户输入研究主题后，系统会生成候选研究方向和研究计划，检索本地资料、arXiv/OpenAlex 和可选 Web Search，再生成带证据引用和局限性说明的结构化报告。它不是普通 ChatBot，我重点做的是研究流程、证据链、流式交互和可复盘能力。

**面试官**：整体技术架构呢？

**你**：后端是 Fastify + TypeScript，核心是多阶段 workflow；前端是 Next.js + Zustand。聊天主流程用 SSE 返回 `ChatEvent`，前端根据事件类型合并消息、工具调用、研究计划和报告状态。本地资料支持 RAG，可选 LanceDB 向量检索；外部学术搜索接 arXiv 和 OpenAlex。

**面试官**：你这里的 Agent 是怎么工作的？

**你**：我把它拆成规划和执行两层。规划层由 coordinator、background investigator、planner 和 human feedback 组成；执行层由 researcher 和 reporter 组成。这样做是因为研究任务天然分阶段，先确定问题和计划，再找证据，最后写报告。拆分后更容易控制、调试和插入人工反馈。

**面试官**：你怎么保证结果可信？

**你**：第一，检索来源是真实的本地资料或 arXiv/OpenAlex 等外部来源；第二，reporter prompt 要求主要事实引用 source id；第三，如果没有证据支持，要写 evidence gap；第四，Trace 和 Replay 可以复盘生成过程。当然这不是形式化证明，所以后续我会加 citation verifier 和 benchmark。

**面试官**：Replay 为什么值得做？

**你**：AI 应用很容易变成黑盒，尤其是流式和多工具调用场景。Replay 保存完整 ChatEvent 流，可以复现用户当时看到的过程；Trace 则帮助开发者定位 workflow 内部过程。一个面向真实使用的 Agent，不只要能生成，还要能解释、调试和复盘。

**面试官**：这个项目如果上线还缺什么？

**你**：主要缺四类：鉴权和多用户隔离、数据保留和删除策略、更系统的评估体系、以及更完整的 CI/CD 和测试覆盖。当前项目更偏面试和本地研究助手 MVP，核心链路已经打通，但生产化还需要补这些工程能力。

## 12. 反问面试官的问题

面试结尾可以反问：

1. 如果在贵团队做 AI Agent，你们更关注模型能力、工具编排，还是评估体系？
2. 团队现在的 AI 应用更偏 Copilot、RAG，还是 Agent workflow？
3. 对 Research Agent 这类产品，你们如何评估 hallucination 和 citation correctness？
4. 如果把这个项目生产化，你们会优先补安全、多用户隔离，还是效果评估？

这些问题能把话题引到工程深度，而不是停留在 demo 层面。

## 13. 最后记忆版

面试前记住这 5 句话：

1. **它不是普通 ChatBot，而是面向学术研究的 Research Agent。**
2. **核心链路是规划、检索、证据整理、报告生成和人工反馈。**
3. **工程亮点是 SSE 流式事件、前端状态合并、RAG/LanceDB、Trace 和 Replay。**
4. **可信度来自真实来源、source id 引用、证据缺口说明和可复盘机制。**
5. **当前是 MVP/面试项目，生产化还要补鉴权、隔离、评估和数据治理。**
