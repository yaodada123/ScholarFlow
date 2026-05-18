# ScholarFlow 面试项目说明文档

> 项目定位：面向学术研究场景的多智能体 Research Agent 系统。  
> 面试表达重点：不要只讲“调用大模型”，而要讲清楚 **工作流编排、RAG、SSE 流式交互、可控性、可观测性和工程化取舍**。

---

## 1. 项目一句话介绍

ScholarFlow 是一个面向学术调研、课题选题和研究报告生成的多智能体系统。它把复杂研究任务拆成 Coordinator、Planner、Researcher、Reporter 多个阶段，支持普通对话模式和研究模式切换；研究模式下会先制定研究计划，再检索本地资料和外部学术来源，最后生成结构化 Markdown 报告。

---

## 2. 简历项目描述

### 版本 A：偏技术

**ScholarFlow：学术研究多智能体 Agent 系统**

- 基于 **TypeScript + Fastify + LangGraph + Next.js + Zustand** 构建学术研究 Agent，支持普通对话、研究计划生成、资料检索、报告生成和研究过程追踪。
- 设计 **Coordinator / Planner / Researcher / Reporter** 多角色工作流，将研究任务拆解为意图判断、研究规划、资料检索、证据聚合和结构化报告生成。
- 实现 **SSE 流式响应协议**，前端实时渲染 Agent 消息、工具调用、工具结果、计划确认中断和报告输出。
- 支持本地学术资料上传与轻量 RAG，结合 arXiv、OpenAlex 和可选 Web Search 获取外部证据来源。
- 新增显式 **Research Mode**，将普通对话和学术调研工作流解耦，避免普通问题误触发长链路 Agent 流程。
- 引入 trace 记录和前端活动面板，方便观察每次运行中的 agent 节点、工具调用和报告生成状态。

### 版本 B：偏产品

**ScholarFlow：面向学术研究的 AI Research Agent**

- 构建面向论文研读、课题选题和研究综述生成的 AI Agent 系统，将通用聊天模型改造成可规划、可检索、可追踪的学术研究助手。
- 用户可以在普通聊天模式下进行自然对话，也可以开启研究模式，让系统自动生成研究计划、检索资料并输出结构化报告。
- 通过多智能体分工提升复杂研究任务的可控性：Coordinator 负责模式与意图判断，Planner 负责任务拆解，Researcher 负责证据检索，Reporter 负责报告生成。
- 支持用户在执行前审阅和修改研究计划，降低长任务中方向跑偏和错误传播的成本。

---

## 3. 30 秒面试介绍

我这个项目是一个面向学术研究场景的多智能体 Research Agent。它不是普通 Chatbot，而是把研究问题拆成多个阶段：Coordinator 负责判断是否进入研究流程，Planner 生成研究计划，Researcher 检索本地论文资料和外部学术来源，Reporter 最后生成结构化报告。

技术上，后端使用 TypeScript、Fastify 和 LangGraph 编排工作流，前端使用 Next.js 和 Zustand，通过 SSE 实时展示 Agent 输出、工具调用和报告生成过程。我最近还加了 Research Mode 开关，让普通对话和研究工作流显式分离，避免普通聊天被误路由到学术调研报告流程。

---

## 4. 2 分钟项目讲述

ScholarFlow 的目标是解决通用大模型在学术研究场景里的几个问题：第一，复杂研究任务缺少规划；第二，回答资料来源不清晰；第三，长链路生成过程不可控。

所以我没有把它做成单轮问答，而是设计成一个多智能体工作流。用户输入研究主题后，系统可以进入研究模式：先由 Coordinator 处理请求，再由 Planner 生成结构化研究计划。计划生成后不会马上执行，而是可以让用户确认或者编辑。确认后，Researcher 会检索本地上传的论文、笔记、课程资料，也可以根据配置调用 arXiv、OpenAlex 和 Web Search。最后 Reporter 会基于计划和检索结果生成结构化 Markdown 报告。

工程上，后端用 Fastify 提供 API 和 SSE 流式接口，用 LangGraph 编排 Agent 节点；前端用 Next.js 和 Zustand 管理聊天状态、研究活动状态和报告状态。整个执行过程会以事件流返回，包括 `message_chunk`、`tool_calls`、`tool_call_result`、`interrupt` 等，前端可以实时展示 Agent 正在做什么。

我最近做了一个重要优化：原来系统会自动判断普通对话还是研究任务，导致一些正常提问也可能进入学术调研报告流程。为了解决这个体验问题，我加了显式 `workflow_mode: "chat" | "research"`，默认普通聊天，只有用户开启 Research Mode 后才进入完整研究工作流。同时也修复了研究面板状态初始化导致的 runtime error。

这个项目的核心价值不是“接了一个模型 API”，而是把学术研究任务拆成一个可控、可观察、可扩展的 Agent pipeline。

---

## 5. 技术架构

### 5.1 前端

- **Next.js App Router**：页面和聊天 UI。
- **React + Zustand**：管理聊天消息、研究面板、报告、活动流和设置。
- **SSE Client**：消费后端流式事件并合并 message chunk。
- **Research Panel**：展示 planner、researcher、reporter 的活动、工具调用和最终报告。
- **Settings Store**：持久化 Research Mode、Deep Thinking、Investigation、Web Search、Report Style、Academic Skills 等配置。

关键链路：

```text
MessageInput
  -> InputBox
  -> MessagesBlock
  -> sendMessage
  -> chatStream
  -> POST /api/chat/stream
```

### 5.2 后端

- **Fastify**：API 服务、CORS、multipart 上传、SSE 输出。
- **Zod**：校验 chat request schema。
- **LangGraph**：编排多阶段 Agent 工作流。
- **OpenAI-compatible Client**：兼容不同模型服务。
- **Local RAG / LanceDB 可选**：上传资料、本地检索、向量检索扩展。
- **Academic Search**：arXiv + OpenAlex。
- **Web Search**：可选 Tavily。
- **TraceRecorder**：记录 run、span、message、tool call 和 interrupt。

核心后端入口：

```text
POST /api/chat/stream
  -> ChatRequestSchema.parse
  -> runChatWorkflow
  -> SSE events
```

---

## 6. Agent 工作流设计

### 6.1 普通聊天模式

默认 `workflow_mode = "chat"`。

```text
User Message
  -> Plain Chat Response
  -> End
```

特点：

- 不进入 planner。
- 不调用 researcher/reporter。
- 不打开 research panel。
- 即使用户上传资源，第一版也不会强制进入研究工作流。
- 如果用户需要完整调研报告，引导其开启 Research Mode。

### 6.2 研究模式

开启 Research Mode 后，`workflow_mode = "research"`。

```text
START
  -> coordinator
  -> background_investigator?  取决于 Investigation + Web Search
  -> planner
  -> human_feedback?          取决于是否自动接受计划
  -> researcher
  -> reporter
  -> END
```

各节点职责：

- **Coordinator**：处理研究模式入口，决定是否交给 planner。
- **Background Investigator**：在规划前做快速背景检索。
- **Planner**：生成结构化研究计划。
- **Human Feedback**：让用户编辑计划或开始研究。
- **Researcher**：检索本地资源和外部学术来源。
- **Reporter**：基于计划和 observations 生成 Markdown 报告。

---

## 7. 核心功能亮点

### 7.1 普通对话与研究工作流显式分离

原问题：普通对话也可能被自动路由到学术调研报告流程，用户体验不自然。

解决方案：新增 `workflow_mode: "chat" | "research"`。

价值：

- 普通聊天更自然。
- 研究流程由用户显式开启，行为可预期。
- `Investigation` 只表示研究模式下的“规划前背景检索”，不再承担“是否进入研究流程”的语义。

面试表达：

> 我把模式选择从隐式 LLM 判断改成显式产品开关，降低了 Agent 系统的不确定性，也让用户能更清楚地控制成本更高的研究工作流。

### 7.2 多智能体职责拆分

不是让一个 prompt 完成所有任务，而是拆成多个阶段。

价值：

- 每个 Agent 的 prompt 更聚焦。
- 中间状态可以展示、调试和复用。
- 某个阶段效果不好时可以单独优化。
- 支持 human-in-the-loop。

### 7.3 Plan-first + Human-in-the-loop

Planner 会先生成研究计划，用户可以选择：

- Edit plan
- Start research

价值：

- 长任务执行前先确认方向。
- 减少无效检索和无效报告生成。
- 提升学术研究任务的可控性。

### 7.4 SSE 流式事件协议

后端不会等最终报告生成完才返回，而是持续输出事件。

典型事件：

- `message_chunk`
- `tool_calls`
- `tool_call_result`
- `interrupt`
- `error`

价值：

- 用户能看到 Agent 正在做什么。
- 前端可以实时展示活动面板。
- 调试时能定位是 planner、tool 还是 reporter 出问题。

### 7.5 本地资料与外部学术检索结合

Researcher 可以结合：

- 用户上传的 Markdown / TXT / PDF 文本资料。
- arXiv。
- OpenAlex。
- 可选 Tavily Web Search。

面试表达：

> 我没有只依赖模型参数知识，而是把本地资料和外部学术来源作为 evidence 输入给 Reporter，尽量让报告基于可追溯资料生成。

### 7.6 Trace 和可观测性

系统记录：

- run start / end
- span start / end
- message metadata
- tool call start / end
- interrupt
- error

价值：

- 复杂 Agent 不是黑盒。
- 可以排查每次输出为什么这样生成。
- 后续可以接入评测和质量分析。

---

## 8. 最近一次关键改造：Research Mode

### 8.1 背景

本地测试时发现，正常对话不应该默认进入学术调研报告工作流。比如用户只是想问一个概念解释，系统却可能进入计划生成、资料检索和报告生成链路。

### 8.2 改造内容

后端：

- `ChatRequestSchema` 增加：

```ts
workflow_mode: z.enum(["chat", "research"]).optional().default("chat")
```

- `runChatWorkflow` 中增加分支：

```text
workflow_mode === "chat"
  -> runPlainChatResponse
  -> return

workflow_mode === "research"
  -> existing research workflow
```

前端：

- Settings store 增加 `workflowMode`。
- `chatStream` 请求透传 `workflow_mode`。
- 输入框增加 Research Mode 按钮。
- Research Mode 关闭时，Investigation 按钮禁用并弱化。
- 中英文文案更新。

### 8.3 Bug 修复

研究模式页面曾出现：

```text
Cannot read properties of undefined (reading 'map')
```

原因：研究面板打开时，`researchActivityIds.get(researchId)` 可能尚未初始化。

修复：

- `ResearchActivitiesBlock` 对缺失 activity ids 回退为空数组。
- `appendResearch()` 返回是否成功初始化 research state。
- 只有成功初始化后才打开 research panel。
- `appendResearchActivity()` 不再对缺失列表强制非空断言。

### 8.4 面试表达

> 这次改造体现了我对 Agent 产品体验的理解：不是所有输入都应该进入复杂工作流。复杂 Agent 流程有成本、有延迟，也更容易出错，所以我把普通聊天和研究流程做成显式模式切换，让系统行为更可控。

---

## 9. 技术难点与回答

### 难点 1：流式 Agent 工作流和前端状态同步

Agent 执行过程中会产生普通消息、planner 输出、tool calls、tool results、interrupt 和 reporter 输出。前端需要根据事件类型和 agent 类型正确合并 message chunk，并决定哪些内容进入聊天列表，哪些内容进入研究面板。

推荐回答：

> 难点不在于单个接口返回，而在于多类型事件的长期流式同步。我的做法是统一 SSE 事件协议，前端用 store 管理 message、research activity、report 和 interrupt 状态，再根据 agent 类型映射到不同 UI 区域。

### 难点 2：多阶段 workflow state 管理

用户可能先生成计划，然后等待确认；之后可能接受计划，也可能编辑计划。因此后端需要维护 thread state：研究主题、当前计划、资源、observations、plan iteration、feedback 状态等。

推荐回答：

> 我把 workflow state 放在 thread store 里，确保用户中断后再次请求时还能恢复上下文，比如继续执行已有计划或根据用户反馈重新规划。

### 难点 3：LLM 输出不稳定

Planner 需要输出 JSON，但 LLM 可能返回 Markdown 或附加解释。

推荐回答：

> 我做了 safe parse：优先直接解析 JSON，失败后从文本中提取 JSON 对象，再失败则使用 fallback plan。这样可以保证 workflow 不会因为一次格式错误完全中断。

### 难点 4：复杂 Agent 的可控性

自动化越强，越容易出现方向跑偏或成本不可控。

推荐回答：

> 我没有追求完全自主执行，而是做了 semi-autonomous workflow。系统先生成计划，再让用户确认或编辑，用户批准后才进入更高成本的检索和报告生成阶段。

---

## 10. 常见追问与推荐回答

### Q1：这个项目和 ChatGPT 有什么区别？

ChatGPT 更像通用问答工具，而 ScholarFlow 是面向学术研究流程的垂直 Agent。它不是直接回答，而是把任务拆成规划、检索、证据整理和报告生成。优势是流程可控、资料可追溯、用户可以干预计划。

一句话：

> ChatGPT 强在通用回答，ScholarFlow 强在按研究流程完成复杂任务。

### Q2：为什么要多 Agent？一个 Agent 不行吗？

一个 Agent 可以做，但所有职责会混在一个 prompt 里，难以调试和优化。拆成多个 Agent 后，Planner 只关注计划，Researcher 只关注检索，Reporter 只关注报告表达。每个阶段都可以单独优化，也能插入人工反馈。

### Q3：为什么新增 Research Mode？

原来系统依赖 coordinator 自动判断是否进入研究流程，但自动判断存在不确定性。普通问题被误路由到研究流程会导致延迟变长、输出不符合预期。Research Mode 把这个决策交给用户显式控制，默认聊天，开启后才进入完整调研链路。

### Q4：RAG 是怎么做的？

当前支持上传本地学术资料，研究阶段会根据用户问题和资源列表检索相关内容，作为 observations 提供给 Reporter。系统也可以接 LanceDB 做向量检索，并结合 arXiv / OpenAlex 获取外部学术来源。

### Q5：如何减少幻觉？

当前主要从流程上降低幻觉风险：

1. 让用户上传或指定资料。
2. Researcher 先检索 evidence。
3. Reporter 基于 observations 和 sources 写报告。
4. 报告中提示限制和来源。

后续可以增强 chunk-level citation grounding，让每个关键结论绑定具体证据片段。

### Q6：怎么测试 Agent 系统？

传统单元测试只能覆盖部分逻辑。Agent 系统需要组合测试：

- schema 和工具函数单元测试。
- SSE event merge 测试。
- workflow smoke test。
- 固定 query + 固定 resources 的 eval case。
- 对 planner、retriever、reporter 分阶段评估。

当前已覆盖前端 store、message merge、markdown 等测试，也做了 chat/research 模式的 SSE smoke test。

### Q7：如果 LLM 不可用怎么办？

普通聊天模式会返回模型未配置提示，不会误进入 planner。研究模式下，planner/reporter 有 fallback，至少能保证工作流不会因为模型缺失直接崩掉。

### Q8：这个项目还有哪些可以优化？

可以从四个方向继续优化：

1. **检索质量**：hybrid search、rerank、metadata filter。
2. **引用可信度**：chunk-level citation、citation verification。
3. **评测体系**：planner/retriever/reporter 分阶段 eval。
4. **持久化与协作**：thread/run/artifact 持久化，多用户历史记录。

---

## 11. STAR 讲述模板

### Situation

本地测试 ScholarFlow 时发现，普通聊天问题也会进入学术调研报告 workflow，导致体验不自然，并且研究面板在某些时机存在状态初始化错误。

### Task

需要让系统支持显式模式切换：默认普通聊天，只有用户开启 Research Mode 才执行完整研究流程。同时修复研究面板的 runtime error。

### Action

- 后端 schema 新增 `workflow_mode: "chat" | "research"`。
- 在 `runChatWorkflow` 中增加 plain chat 分支。
- 前端 settings store 增加 `workflowMode` 并持久化。
- 输入框新增 Research Mode 按钮。
- 关闭 Research Mode 时禁用 Investigation，避免概念混淆。
- 修复 `researchActivityIds` 未初始化导致的 `.map()` 报错。
- 跑 typecheck、测试和 SSE smoke test 验证。

### Result

- 普通对话默认不再触发 planner/researcher/reporter。
- 研究模式开启后仍保留完整学术调研报告工作流。
- 研究面板 runtime error 被修复。
- 系统交互更可控，模式语义更清晰。

---

## 12. 演示脚本

### 演示前准备

启动服务：

```bash
npm run dev:all
```

打开前端：

```text
http://localhost:3300
```

### Demo 1：普通聊天模式

确保 Research Mode 关闭。

输入：

```text
帮我解释一下 Transformer 的 self-attention。
```

预期：

- 直接对话式回答。
- 不出现 planner JSON。
- 不出现 Edit plan / Start research。
- 不打开 research panel。

讲解：

> 这里展示的是普通聊天模式，适合概念解释和一般问答。系统不会误触发复杂研究工作流。

### Demo 2：研究模式

开启 Research Mode。

输入：

```text
调研多智能体学术助手的现状，并输出一份结构化报告。
```

预期：

- Coordinator 响应。
- Planner 生成研究计划。
- 用户可选择 Edit plan 或 Start research。
- Researcher 检索资料。
- Reporter 生成报告。

讲解：

> 这里展示完整 Agent pipeline。用户开启研究模式后，系统先规划，再检索，再生成报告，而不是直接给一个不可控答案。

### Demo 3：Investigation 子开关

Research Mode 开启，关闭 Investigation。

输入同样研究问题。

预期：

- 仍进入 planner/researcher/reporter。
- 不运行 background investigation。

讲解：

> Research Mode 控制是否进入研究工作流，Investigation 只是控制研究模式下是否在规划前做背景检索。

### Demo 4：上传资料

上传一篇 Markdown/TXT/PDF 文本资料，开启 Research Mode 后提问：

```text
基于我上传的资料，总结其中适合做课题选题的方向。
```

预期：

- Researcher 检索本地资料。
- Reporter 报告中结合上传内容。

讲解：

> 这部分体现本地资料接入和轻量 RAG 能力。

---

## 13. 面试时可以强调的工程取舍

### 13.1 为什么默认普通聊天？

因为复杂 Agent workflow 有成本和延迟，不应该对所有输入自动触发。默认 chat 更符合用户直觉，research 作为显式高阶能力开启。

### 13.2 为什么保留 Investigation？

Research Mode 和 Investigation 不是同一层概念：

- Research Mode：是否进入研究工作流。
- Investigation：研究工作流中，规划前是否做背景检索。

### 13.3 为什么先做轻量 RAG？

先跑通端到端产品闭环，再优化检索质量。这样可以先验证 Agent workflow、SSE、UI、报告生成和用户反馈机制。

### 13.4 为什么用 SSE 而不是普通 HTTP？

研究任务耗时较长，普通 HTTP 等最终结果体验差。SSE 更适合服务端单向持续推送，前端能实时展示 agent 活动和中间结果。

---

## 14. 可继续增强的方向

### 14.1 Chunk-level Citation Grounding

让报告引用具体 chunk，而不是只引用整篇资料。

### 14.2 Hybrid Search + Rerank

结合 vector search、BM25、metadata filter 和 reranker，提高学术资料检索质量。

### 14.3 Agent Eval Pipeline

构造固定 eval case，分别评估：

- plan quality
- retrieval hit rate
- citation coverage
- report completeness
- hallucination risk

### 14.4 Persistent Thread / Run / Artifact

持久化对话、研究运行、报告 artifact 和 trace，支持历史回看和多人协作。

### 14.5 Tool Safety

为外部工具增加：

- allowlist
- schema validation
- timeout
- result size limit
- prompt injection 防护
- human approval

---

## 15. 项目关键词速记

面试时可以反复围绕这些词展开：

- Multi-Agent Workflow
- Research Agent
- LangGraph
- SSE Streaming
- Human-in-the-loop
- Plan-first
- RAG
- Evidence Grounding
- Traceability
- Workflow Mode
- Controlled Autonomy
- Tool Calling
- State Management
- Agent Evaluation

---

## 16. 最推荐的收尾表达

> 这个项目最大的收获是，我发现 Agent 系统的难点不只是“让模型回答”，而是如何把不稳定的大模型能力包装成一个可控的工程系统。ScholarFlow 里我把研究任务拆成规划、检索、报告生成多个阶段，并用 SSE、状态管理、人工确认和 trace 把整个过程做成可观察、可干预的 pipeline。后续如果继续完善，我会重点补强 evidence grounding 和 eval pipeline，让它从能生成报告进一步升级为能被验证和持续优化的研究助手。
