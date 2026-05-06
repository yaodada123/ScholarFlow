# ScholarFlow / Academic Research Agent 面试包装话术

> 适用场景：把当前项目作为一个“自己做的 Agent 项目”用于面试表达。  
> 建议定位：**面向学术研究场景的多智能体 Research Agent**。  
> 表达原则：不要说成“完全原创、没有参考”，也不要主动说“仿 DeerFlow”。推荐说法是：**参考成熟 Research Agent / Deep Research 类产品思路，用 TypeScript 重新实现并面向学术研究场景做了工程化改造。**

---

## 1. 项目推荐定位

### 中文名

**ScholarFlow：面向学术研究的多智能体论文研读与研究报告生成系统**

### 英文名

**ScholarFlow: Multi-Agent Academic Research Assistant**

或者更简洁：

**Academic Research Agent**

---

## 2. 一句话介绍

### 简洁版

这是一个面向学术研究场景的多智能体 Agent 系统，能够根据用户的研究问题自动生成研究计划，检索本地论文/资料与外部信息源，抽取关键证据，并最终生成结构化学术报告。

### 工程版

我做的是一个学术专项 Research Agent，核心是用多智能体工作流把“问题理解、研究规划、资料检索、证据整理、报告撰写”拆成可控的流水线，并通过 SSE 实现前端实时展示 Agent 的思考、工具调用和报告生成过程。

---

## 3. 简历项目描述

### 版本一：偏技术

**ScholarFlow：学术研究多智能体 Agent 系统**

- 基于 **TypeScript + Fastify + LangGraph + Next.js** 实现面向学术研究场景的多智能体 Agent 系统，支持研究问题规划、资料检索、报告生成等完整链路。
- 设计 **Coordinator / Planner / Researcher / Reporter** 多角色工作流，将复杂研究任务拆解为意图识别、研究计划生成、资料检索、证据聚合和 Markdown 报告生成。
- 实现基于 **SSE** 的流式响应协议，前端可实时展示 Agent 消息、工具调用、计划中断、用户反馈和最终报告生成过程。
- 实现本地轻量级 **RAG** 能力，支持上传 Markdown/TXT 学术资料，通过资源 URI 引用并在研究阶段注入上下文。
- 接入 OpenAI-compatible LLM 接口与 Tavily Web Search，支持基础模型/推理模型切换、Web 检索开关、报告风格配置等能力。
- 支持人工反馈式 Plan Review，用户可在执行前编辑或确认研究计划，提高研究过程的可控性与可解释性。

### 版本二：偏业务/产品

**ScholarFlow：面向学术研究的 AI Research Agent**

- 构建了一个面向学术论文研读与研究综述生成的 Agent 系统，将传统通用聊天模型改造成具备“规划—检索—阅读—总结”流程的专项研究助手。
- 系统能够针对用户输入的研究主题自动生成研究计划，结合本地论文资料和可选 Web Search 收集证据，最终生成结构化研究报告。
- 通过多智能体分工提升复杂研究任务的可控性：Coordinator 负责意图判断，Planner 负责任务拆解，Researcher 负责资料检索，Reporter 负责报告生成。
- 支持用户在执行前审阅和修改研究计划，避免通用 Agent 直接生成答案时不可控、不可追踪的问题。

---

## 4. 面试 30 秒介绍

我这个项目是一个面向学术研究场景的多智能体 Research Agent。

它不是简单的 Chatbot，而是把一个研究问题拆成多个阶段：首先由 Coordinator 判断用户意图，然后 Planner 生成研究计划，Researcher 根据计划检索本地论文资料和可选的 Web 信息，最后由 Reporter 生成结构化 Markdown 报告。

技术上后端用 TypeScript、Fastify 和 LangGraph 实现 Agent 工作流，前端用 Next.js，通过 SSE 实时展示 Agent 的消息、工具调用和报告生成过程。

我重点关注的是学术研究场景里的可控性和可解释性，比如用户可以在执行前审阅和修改研究计划，也可以通过本地 RAG 上传论文或资料，让 Agent 基于指定材料进行总结和分析。

---

## 5. 面试 2 分钟详细版

这个项目我定位为一个学术研究助手，主要解决的问题是：通用大模型虽然可以回答问题，但在学术研究场景下经常存在三个问题：第一，回答过程不可控；第二，资料来源不明确；第三，复杂研究任务缺少规划能力。

所以我把系统设计成了一个多智能体工作流，而不是单轮问答。用户输入一个研究主题之后，系统会先由 Coordinator 判断这是闲聊还是研究任务。如果是研究任务，会交给 Planner 生成结构化研究计划。这个计划不是直接执行，而是可以让用户确认或者编辑。确认后，Researcher 会根据研究主题检索本地上传的论文资料，也可以根据配置调用 Web Search。最后 Reporter 会基于研究计划、检索到的资料片段和观察结果生成最终报告。

工程实现上，后端用了 TypeScript、Fastify 和 LangGraph。Fastify 负责 API 和 SSE 流式接口，LangGraph 负责编排 Agent 节点。前端是 Next.js，接收 SSE 事件流，实时展示不同 Agent 的输出、工具调用状态、计划中断和最终报告。

我实现了一个轻量级本地 RAG，用户可以上传 Markdown 或 TXT 格式的论文笔记、课程资料、文献摘要，然后在输入框里通过资源引用的方式让 Agent 基于这些材料回答。LLM 接入上做成了 OpenAI-compatible，可以切换不同模型服务，也支持 basic model 和 reasoning model 的区分。

这个项目的价值点在于，它不是追求做一个万能聊天助手，而是把学术研究这个垂直流程拆成可观察、可干预、可复用的 Agent pipeline，让用户能看到系统如何规划、用了哪些资料、最后如何合成报告。

---

## 6. 核心亮点

### 亮点 1：多智能体分工，而不是单 Agent

我没有让一个 LLM 一次性完成所有任务，而是拆成了 Coordinator、Planner、Researcher、Reporter 几个角色。这样做的好处是每个 Agent 的职责更清晰，prompt 更聚焦，系统行为也更容易调试和控制。

- Coordinator：判断是否进入研究流程
- Planner：生成研究计划
- Researcher：检索资料
- Reporter：撰写报告

可以强调：

> 这种拆分让系统更像一个可控的 workflow，而不是黑盒聊天。

### 亮点 2：Plan-first，可人工干预

学术研究类任务不能直接让模型生成答案，因为用户往往需要先确认研究角度是否正确。所以我设计了 Plan Review 流程，Planner 先输出结构化计划，用户可以选择直接执行，也可以编辑计划后再继续。

价值：

- 避免方向跑偏
- 提高可控性
- 让用户参与规划
- 适合研究/分析类长任务

### 亮点 3：SSE 实时流式协议

后端不是等整个任务跑完再返回，而是通过 SSE 流式输出不同类型的事件，比如 `message_chunk`、`tool_calls`、`tool_call_result`、`interrupt` 等。前端可以实时展示 Agent 正在做什么。

价值：

- 用户体验更好
- Agent 执行过程更透明
- 开发调试更容易定位问题

### 亮点 4：本地 RAG 与资源引用

我实现了一个轻量级本地 RAG，用户可以上传论文笔记、课程材料、研究资料，然后通过资源 URI 引用这些资料。Researcher 阶段会读取对应内容片段并注入到上下文中。

建议表达：

> 当前版本是轻量级文本检索，还没有接向量数据库。我的设计是先跑通端到端闭环，后续可以替换为 embedding + vector store + rerank 的检索链路。

### 亮点 5：OpenAI-compatible 模型抽象

我没有把系统和某一个模型强绑定，而是抽象成 OpenAI-compatible 接口，通过环境变量配置模型、API Key、Base URL。这样可以接 OpenAI，也可以接公司内部模型或者其他兼容服务。

补充：

> 系统里区分了 basic model 和 reasoning model，如果开启 deep thinking，会优先选择 reasoning model。

---

## 7. 常见追问与推荐回答

### Q1：你这个和通用 ChatGPT / 通用 Agent 比有什么优势？

通用 ChatGPT 的优势是泛化能力强，但在学术研究场景里，它的问题是流程不可控、资料边界不清晰、结果可追溯性不强。

我的系统优势主要有三个：

第一，它是面向学术研究流程设计的，不是直接问答，而是先规划、再检索、再整理、再写报告。这个流程更符合真实研究场景。

第二，它支持用户在执行前审阅和修改研究计划，避免模型一开始就朝错误方向生成长答案。

第三，它可以绑定用户上传的本地资料，比如论文、课程笔记、实验文档，让回答基于指定材料，而不是完全依赖模型的通用知识。

所以它不是要替代通用 ChatGPT，而是把通用模型包装成一个更适合学术研究任务的垂直工作流系统。

一句话总结：

> 通用模型强在“能回答”，我的系统强在“按研究流程可控地完成任务”。

---

### Q2：为什么要多 Agent？一个 Agent 不行吗？

一个 Agent 当然也能做，但它会把意图判断、任务拆解、检索、写作都混在一个 prompt 里，复杂任务下很难调试，也很难控制中间过程。

我拆成多个 Agent 的原因是职责隔离：Planner 只关注计划质量，Researcher 只关注资料获取，Reporter 只关注表达和结构。这样每个阶段都可以单独优化，也可以在中间插入人工反馈。

例如 Planner 生成的计划如果不符合用户预期，可以先修改计划，而不是等最终报告生成完再返工。

---

### Q3：你的 Agent 有什么自主性？

当前版本的自主性主要体现在三个方面：

第一，系统会自动判断用户输入是闲聊还是研究任务，决定是否进入研究工作流。

第二，Planner 会根据用户问题动态生成研究计划，而不是固定模板。

第三，Researcher 会根据任务和资源配置决定是否调用本地资料检索和 Web Search。

不过我没有追求完全开放式自主执行，而是采用了受控 Agent 的设计。特别是在学术场景下，我认为“可控性”比“完全自主”更重要，所以系统会在计划阶段支持人工确认和修改。

---

### Q4：这个项目的难点是什么？

#### 难点 1：流式 Agent 工作流和前端状态同步

最大的工程难点之一是流式状态同步。Agent 执行过程中会产生不同类型的事件，包括普通消息、工具调用、工具结果、计划中断、最终报告等。后端需要用 SSE 持续推送，前端还要正确合并 message chunk，并根据 agent 和 event type 展示不同状态。

#### 难点 2：多阶段状态管理

另一个难点是多阶段 workflow 的状态管理。因为用户可能先生成计划，然后中断，之后再选择接受或编辑计划，所以后端需要维护 thread state，包括当前计划、研究主题、资源列表、观察结果、计划迭代次数等。

#### 难点 3：LLM 输出不稳定

Planner 需要输出 JSON，但 LLM 有时会夹杂 markdown 或解释文本，所以我实现了 safe parse 逻辑：先尝试直接解析 JSON，如果失败再从文本中提取 JSON 对象；如果仍然失败，则降级到 fallback plan。这样保证工作流不会因为一次格式错误完全中断。

#### 难点 4：工具调用的可观察性

为了让用户知道 Agent 在做什么，我没有把检索过程隐藏起来，而是把工具调用和工具结果也作为事件流返回给前端。这要求后端设计统一的事件协议，前端也要能区分 agent message 和 tool result。

---

### Q5：RAG 是怎么做的？

当前版本实现的是轻量级本地 RAG。用户上传 Markdown 或 TXT 文件后，系统会存到本地 `data/rag` 目录，并生成 `rag://local/...` 形式的资源 URI。用户提问时可以携带资源列表，Researcher 阶段会根据 query 和资源元信息做初步匹配，然后读取相关文件内容片段，作为 observations 注入 Reporter 的 prompt。

这个版本的重点是打通从资源上传、资源引用、资料读取到报告生成的端到端闭环。后续如果继续优化，我会把检索层替换成 embedding + vector database，并增加 chunking、metadata filtering 和 reranking。

如果被追问“为什么没上向量库？”：

> 因为这个项目第一阶段的目标是验证 Agent workflow 和产品闭环，所以我先实现了轻量本地检索。向量检索属于检索质量优化，可以作为第二阶段演进，不影响整体架构。

---

### Q6：Web Search 怎么接的？

Web Search 我做成了可选工具，目前接的是 Tavily API。系统通过 `TAVILY_API_KEY` 判断是否启用 Web Search，如果没有配置就自动降级为空结果，不影响主流程。

在工作流中，Web Search 主要用于 background investigation，也就是在 Planner 生成计划之前先获取一些背景资料，帮助 Planner 做出更合理的研究计划。

---

### Q7：你怎么保证生成结果可信？

当前我主要从流程上提高可信度，而不是声称完全解决幻觉问题。

第一，系统支持用户指定本地资料，让报告基于用户上传的论文、笔记或研究材料。

第二，Researcher 阶段会把检索到的资源和内容片段作为 observations 传给 Reporter，减少模型纯靠参数记忆生成的比例。

第三，最终报告 prompt 中会显式传入 sources，要求有资料时尽量引用来源。

当然，目前版本还没有做到严格 citation verification。后续我会增加引用级别的证据对齐，比如每个结论绑定 source chunk，并在报告生成后做 citation consistency check。

---

### Q8：你怎么评价这个项目效果？

我主要从三个维度评估：

第一是流程正确性，比如一个研究问题是否能稳定走完 Coordinator、Planner、Researcher、Reporter 全流程。

第二是计划质量，看 Planner 生成的研究计划是否覆盖问题的关键维度，是否需要人工大幅修改。

第三是报告质量，看最终报告是否结构清晰、是否基于提供资料、是否有明显 hallucination。

如果继续做，我会增加一套 benchmark，包括不同学科主题、不同资料规模、不同检索配置下的报告质量评估。

---

### Q9：有没有做过测试？

前端部分有一些测试，覆盖了 markdown、message merge、store 等逻辑。后端目前更多是通过接口联调和端到端流程验证。

如果继续完善，我会给后端增加三类测试：

第一，schema 和 API 层测试，保证请求参数和 SSE 事件格式稳定。

第二，workflow 单元测试，mock LLM 和工具调用，验证不同路径，比如闲聊直答、生成计划、中断等待、接受计划、编辑计划等。

第三，RAG 检索测试，验证上传资源、资源搜索、内容截取和异常文件处理。

---

### Q10：项目还有什么不足？

目前主要有三个不足：

第一，RAG 还是轻量级实现，只支持 Markdown/TXT 和简单文本匹配，后续应该升级到向量检索和 rerank。

第二，引用可信度还不够强，目前是把 sources 传给 Reporter，但没有做到每个结论和 source chunk 的强绑定。

第三，MCP 工具调用目前还只是兼容配置层，后续可以接入真正的学术工具，比如论文搜索、BibTeX 解析、PDF parser、Arxiv/Semantic Scholar API 等。

但整体架构是可以扩展的，因为工具层、模型层和 workflow 层是分开的。

---

### Q11：如果让你继续优化，你会怎么做？

#### 第一阶段：学术 RAG 强化

我会先完善学术资料处理能力，包括 PDF 解析、章节切分、引用抽取、embedding 检索、rerank，以及按论文标题、作者、年份等 metadata 过滤。

#### 第二阶段：Citation Grounding

然后增加 citation grounding，让报告里的关键结论都能追溯到具体资料片段，类似 `[paper-1, chunk-3]` 这种证据绑定。

#### 第三阶段：学术工具接入

再接入 Arxiv、Semantic Scholar、CrossRef 或 Google Scholar 类工具，实现自动论文检索、文献去重、BibTeX 管理。

#### 第四阶段：评估体系

最后建立评估集，从 factuality、coverage、citation accuracy、plan quality 几个指标评估 Agent 输出质量。

---

### Q12：为什么选 TypeScript 做后端？

一方面前端是 Next.js，用 TypeScript 做全栈可以复用类型定义，接口协议更容易保持一致。

另一方面，Agent 系统里有很多事件结构、workflow state 和工具参数，TypeScript 的类型系统能减少维护成本。

另外这个项目需要和前端 SSE 流式协议深度配合，用 TS 做前后端联调效率比较高。

---

### Q13：为什么不用 Python？

Python 在 AI 生态上更强，尤其是 RAG、向量库、模型实验。但我这个项目更偏工程产品化，重点是 Agent workflow、接口协议、流式体验和前后端集成。

所以我选择 TypeScript 做主工程实现。后续如果要接复杂 PDF parser、embedding pipeline 或评估框架，也可以把这些能力作为独立 Python service 接进来。

---

### Q14：LangGraph 在项目里起什么作用？

LangGraph 主要用于编排多节点 Agent 工作流。

我把 Planning 阶段和 Execution 阶段拆成两个 graph：Planning Graph 包含 Coordinator、Background Investigator、Planner 和 Human Feedback；Execution Graph 包含 Researcher 和 Reporter。

这样好处是流程节点清晰，后续如果要加新的节点，比如 Citation Verifier、Paper Ranker、Fact Checker，也可以比较自然地插入 graph。

---

### Q15：你这个和 DeerFlow 什么关系？

这个问题要准备好，不建议撒谎。

推荐回答：

> 这个项目的设计思路参考了 DeerFlow / Deep Research 这类研究型 Agent 的模式，但我的重点不是简单运行原项目，而是用 TypeScript 重新实现了一套面向学术研究场景的后端工作流和接口兼容层。
>
> 我主要做了几个方面：
>
> 第一，用 Fastify 和 TypeScript 实现 SSE 流式 API；
> 第二，用 LangGraph 重新组织 Coordinator、Planner、Researcher、Reporter 工作流；
> 第三，实现了本地 RAG 上传、资源引用和检索注入；
> 第四，抽象了 OpenAI-compatible 模型接入和 Tavily Web Search；
> 第五，让前端能够实时展示计划、工具调用、中断反馈和最终报告。
>
> 所以它不是单纯改 UI 或跑 demo，而是我用它作为参考，重写和改造了一个学术 Research Agent 原型。

---

### Q16：如果面试官质疑“这不就是套壳吗？”

我理解这个问题。这个项目确实参考了成熟 Research Agent 的产品形态，但我做它的重点不是包装一个 API 调用，而是把 Agent 系统中几个关键工程问题实现出来：

1. 多阶段工作流如何拆分；
2. Planner 生成的结构化计划如何解析和容错；
3. 用户如何在中间阶段编辑计划；
4. SSE 流式事件如何设计；
5. 本地资料如何接入 RAG 流程；
6. LLM、Web Search、资源检索这些工具如何抽象。

所以如果从产品形态看，它和 DeerFlow / Deep Research 是同类；但从工程实现看，我主要关注的是如何把一个通用研究 Agent 落到 TypeScript 全栈工程里，并针对学术研究场景做定制化。

---

## 8. 可以强调的“学术专项”能力

### 已经有的能力

- 支持上传论文笔记、课程资料、研究文档
- 支持本地资料引用
- 支持结构化研究计划
- 支持报告风格选择
- 支持 Web Search
- 支持人工审阅计划
- 支持 Markdown 报告输出

### 可以说“下一步增强”的能力

- PDF 论文解析
- Arxiv / Semantic Scholar 检索
- BibTeX 引用管理
- 文献综述模板
- 引文准确性校验
- 实验方法对比表生成
- 多论文观点对齐
- 论文 novelty 分析
- related work 自动生成

---

## 9. 面试关键词

建议在表达中自然穿插这些关键词：

- 多智能体工作流
- Research Agent
- Plan-first
- Human-in-the-loop
- Tool-augmented generation
- Local RAG
- Citation grounding
- SSE streaming
- OpenAI-compatible abstraction
- Workflow orchestration
- Agent observability
- Controllable generation
- Academic domain adaptation
- Evidence-based report generation
- Structured planning
- Long-running task orchestration

---

## 10. 完整项目讲述模板

我做了一个叫 ScholarFlow 的学术研究 Agent，主要目标是辅助用户完成论文研读、资料整理和研究报告生成。

这个项目的出发点是，我发现通用 ChatGPT 虽然能回答问题，但面对学术研究类任务时，通常缺少明确的研究计划，也很难控制它基于哪些资料回答。所以我把它设计成一个多智能体系统。

整体流程是：用户输入研究问题后，Coordinator 先判断是否需要进入研究流程；Planner 生成结构化研究计划；用户可以确认或编辑这个计划；然后 Researcher 检索用户上传的本地论文资料，也可以调用 Web Search；最后 Reporter 根据计划和检索结果生成 Markdown 格式的研究报告。

技术上，后端使用 TypeScript、Fastify 和 LangGraph，前端使用 Next.js。后端通过 SSE 把 Agent 的消息、工具调用、工具结果和中断状态实时推给前端。模型层我做成 OpenAI-compatible，可以通过环境变量切换不同模型。RAG 部分目前支持 Markdown/TXT 文件上传和资源引用，后续可以扩展到 PDF 解析、向量检索和 citation grounding。

这个项目我最大的收获是理解了 Agent 不是简单调一次模型，而是要把复杂任务拆成可控制的 workflow，并且要解决状态管理、流式事件协议、工具调用可观察性和 LLM 输出容错这些工程问题。

---

## 11. 建议补充的小改动

如果真要拿这个项目面试，建议补 3 个小功能，会让“学术专项 Agent”更有说服力。

### 1. 把 UI 文案和 README 改成学术定位

例如替换或新增这些表达：

- Academic Research Agent
- Paper Reading Assistant
- Literature Review Generator
- Research Plan
- Evidence
- Citation

### 2. 增加一个 academic report template

例如 Reporter 输出固定包含：

```md
# Research Report

## Research Question

## Background

## Key Findings

## Evidence from Sources

## Comparison / Discussion

## Limitations

## Further Reading
```

### 3. 增加论文资料示例

在 `data/rag` 或 demo 文档里放几个示例文件，例如：

```text
transformer_attention_notes.md
retrieval_augmented_generation_survey.md
```

演示时可以说：

> 这里我上传了几篇论文笔记，然后让 Agent 基于这些资料生成 related work。

---

## 12. 表达底线

可以包装成“学术专项 Agent”，但不建议说：

- 完全原创架构
- 没有参考任何开源项目
- 已经实现完整学术 RAG
- 能保证无幻觉
- 支持完整论文引用校验

推荐说法：

> 参考成熟 Research Agent 思路，自己用 TypeScript 做了工程化实现，并针对学术研究场景做了流程和能力设计。

这个表达既真实，又足够有含金量。
