# Agent 系统面试亮点与可讨论功能

## 总体建议

这个项目不建议为了面试堆太多功能，更有价值的是突出几个能体现“Agent 工程能力”的点：

- 可控规划
- 可靠检索
- 可观测评估
- 工具安全执行

当前系统已经有 coordinator / planner / researcher / reporter 的多阶段工作流，又接入了本地 RAG、学术搜索、Web Search 和 LanceDB 向量检索。后续最适合包装和补强的方向，是让系统从“能生成报告”升级为“能解释过程、追溯证据、评估质量、控制风险”的 Agent 工程系统。

---

## 1. Agent Trace / 可观测执行链路

**推荐优先级：最高**

当前系统已经有 coordinator、planner、researcher、reporter 的流程。如果面试时能展示一条完整 trace，会非常加分。

可以加入：

- 每一步 agent 输入 / 输出
- planner 生成的 plan
- researcher 调用过哪些 tool
- RAG 命中了哪些 chunk
- academic search 返回了哪些 sources
- reporter 最终引用了哪些 evidence
- 每一步耗时、token、错误、fallback

面试亮点说法：

> 我没有把 Agent 当成黑盒，而是把每次推理、检索、工具调用和最终报告生成都结构化记录下来，方便 debug、评估和复现。

可讨论问题：

- Agent 不稳定时怎么定位？
- hallucination 是 planner 问题、retrieval 问题，还是 reporter 问题？
- 如何做离线评估和线上观测？
- trace 数据应该保存多久？
- trace 中是否会包含敏感内容？

为什么适合这个项目：

- 当前 workflow 已经天然分阶段。
- SSE 流式事件已经存在，可以扩展成结构化 trace。
- 面试时展示 trace 比单纯展示最终报告更能体现工程深度。

---

## 2. RAG Citation Grounding / 证据级引用

**推荐优先级：最高**

当前已经接入 LanceDB 向量检索，下一步很适合做 chunk-level citation grounding。

现在资源级引用类似：

```text
rag://local/paper.md
```

可以升级为 chunk 级引用：

```text
rag://local/paper.md#chunk=3
```

Reporter 输出时可以引用具体 chunk：

```md
根据资料 [paper.md#chunk=3]，该方法主要解决……
```

可以加入：

- chunk id
- chunk source title
- chunk index
- similarity score
- excerpt
- reporter 引用约束
- citation coverage 检查

面试亮点说法：

> 我把 RAG 从“把资料塞进 prompt”升级成了 evidence-grounded generation，每个结论都可以追溯到具体 chunk，而不是只引用整篇文档。

可讨论问题：

- 怎么减少 hallucination？
- 怎么判断报告是否真的 grounded？
- chunk 太碎或太大分别有什么问题？
- citations 应该由模型生成，还是系统后处理校验？
- 如果引用的 chunk 不支持模型结论，应该如何处理？

为什么适合这个项目：

- 系统定位是学术研究 Agent，引用质量天然重要。
- LanceDB 已经把资料切成 chunk，可直接扩展 chunk-level URI。
- 这个点很适合展示 RAG 质量意识。

---

## 3. Human-in-the-loop Plan Editing / 人工干预规划

**推荐优先级：高**

当前系统有 planner，如果能让用户在执行前编辑 plan，会很适合面试介绍。

推荐流程：

1. 用户提出研究问题。
2. Planner 生成研究计划。
3. 前端展示 plan。
4. 用户可以接受、修改、删除步骤或增加约束。
5. Researcher 按最终 plan 执行。

面试亮点说法：

> 我把 Agent 设计成 semi-autonomous，而不是完全自动。用户可以在高成本工具调用前审查和修改 plan，降低错误传播成本。

可讨论问题：

- 为什么不让 Agent 直接执行？
- 哪些场景需要 human approval？
- plan 修改后如何保持 state consistency？
- 自动化和可控性怎么平衡？
- 用户修改 plan 后，planner 是否需要重新验证？

为什么适合这个项目：

- 学术研究任务通常开放性强，plan 很容易影响最终质量。
- 人工介入能提升可信度。
- 面试时可以体现你理解真实 Agent 产品里的“可控性”问题。

---

## 4. RAG Hybrid Search + Rerank

**推荐优先级：高**

LanceDB 向量检索之后，可以继续增强为 hybrid retrieval。

推荐方案：

- 向量检索：召回语义相关内容
- keyword / BM25：召回精确术语、公式、人名、论文名
- reranker：对 top 20 候选 chunk 重排，最终取 top 5 注入 prompt

面试亮点说法：

> 我没有只依赖 embedding similarity，而是做了 hybrid retrieval。向量召回负责语义相关，关键词召回负责精确匹配，reranker 负责最终排序。

可讨论问题：

- 纯向量检索为什么会漏掉关键词？
- BM25 和 vector search 怎么融合？
- rerank 的成本和收益怎么权衡？
- top-k 过大为什么会伤害生成质量？
- hybrid search 的权重如何调参？

为什么适合这个项目：

- 学术资料里经常有专有名词、公式、缩写和论文名。
- 纯向量检索可能对精确匹配不稳定。
- 这是 RAG 面试里常见且容易展开的点。

---

## 5. Agent Evaluation / 自动化评测闭环

**推荐优先级：很高，尤其适合面试**

可以加入一套简单 eval，不需要一开始做得很复杂。

示例 eval case：

```json
[
  {
    "query": "总结 Transformer 的主要创新",
    "resources": ["attention.md"],
    "expected_sources": ["attention.md"],
    "rubric": [
      "是否解释 self-attention",
      "是否提到并行训练",
      "是否引用资料"
    ]
  }
]
```

可以评估：

- plan quality score
- retrieval hit rate
- citation coverage
- answer completeness
- hallucination check
- latency / cost

面试亮点说法：

> 我没有只靠人工试用判断 Agent 效果，而是设计了一套 eval pipeline，分别评估 planner、retriever、reporter 的质量。

可讨论问题：

- Agent 系统怎么测试？
- RAG 的 recall 怎么评估？
- LLM-as-judge 可靠吗？
- 怎么避免只优化 benchmark？
- 如何区分 retrieval failure 和 generation failure？

为什么适合这个项目：

- 多阶段 Agent 很难只用传统单元测试覆盖。
- eval pipeline 能体现工程化落地能力。
- 面试时这个点比单纯“接了模型 API”更有深度。

---

## 6. Tool Safety / MCP 工具安全执行

**推荐优先级：中高**

当前 MCP 还是偏占位。如果面试想讲 Agent 平台能力，可以做一个小而完整的 tool execution layer。

不一定要接很多工具，接 1-2 个就够，例如：

- calculator
- local file search
- web fetch
- paper metadata fetch
- citation formatter

关键不是工具数量，而是安全机制：

- tool allowlist
- 参数 schema validation
- execution timeout
- tool result size limit
- error fallback
- trace logging
- human approval for risky tools

面试亮点说法：

> 我把工具调用做成了受控执行，而不是让模型任意调用外部能力。每个 tool 都有 schema、权限、超时、日志和失败降级。

可讨论问题：

- Agent 调工具有什么安全风险？
- 怎么防 prompt injection？
- 哪些工具需要人工确认？
- tool result 怎么避免污染上下文？
- 工具失败时应该重试、降级还是中断？

为什么适合这个项目：

- 当前系统已经有 MCP 设置入口，但执行链路还没完整实现。
- 可以把“支持 MCP”从配置层升级到安全执行层。
- 面试时能体现你对 Agent 安全边界的理解。

---

## 7. Memory / Research Session Memory

**推荐优先级：中**

可以加入简单的 project-level memory 或 research session memory。

可以记住：

- 用户偏好的报告风格
- 已研究过的主题
- 常用资料库
- 已确认的研究方向
- rejected assumptions
- 用户不希望重复展开的方向

面试亮点说法：

> 我为 Agent 加了跨轮次 research memory，让它能记住用户偏好和已验证结论，而不是每次都从零开始。

可讨论问题：

- 什么应该记，什么不应该记？
- memory stale 怎么办？
- memory 和 RAG 有什么区别？
- 用户隐私怎么处理？
- 记忆应该自动写入还是用户确认后写入？

注意：

这个点容易发散，建议作为讨论点，不一定优先实现。

---

## 8. Report Quality Guardrails / 报告生成前后校验

**推荐优先级：中高**

当前项目已有 report evaluator 的雏形，可以进一步做成亮点。

可以加入：

- citation coverage check
- unsupported claim detection
- section completeness check
- source diversity check
- contradiction check
- final self-critique pass

推荐流程：

```text
Reporter 生成报告
→ Evaluator 检查
→ 如果低于阈值，返回 Reporter 修订
→ 最终输出
```

面试亮点说法：

> 我没有让 Reporter 一次生成就结束，而是加入了 evaluator loop，对 citation、完整性和 unsupported claims 做自动检查。

可讨论问题：

- self-reflection 是否真的有效？
- evaluator 和 generator 用同一个模型可靠吗？
- 多轮修订什么时候停止？
- 如何控制成本？
- evaluator 的判断标准如何设计？

为什么适合这个项目：

- 项目目标是生成学术报告，质量校验天然重要。
- evaluator loop 能体现可靠性设计。
- 可以和 Agent Trace、Eval Pipeline 结合展示。

---

## 9. Background Investigation 结果缓存

**推荐优先级：中**

当前 academic search / web search 可能重复调用。可以做缓存来提升稳定性和响应速度。

可以缓存：

- query cache
- source cache
- embedding cache
- chunk hash cache
- search result TTL

面试亮点说法：

> 我对高成本和不稳定的外部搜索做了缓存，避免重复调用，也提升了 Agent 的响应速度和稳定性。

可讨论问题：

- 哪些内容适合缓存？
- cache invalidation 怎么做？
- 搜索结果过期怎么办？
- embedding cache 如何按 content hash 复用？
- 缓存是否会引入过期信息风险？

为什么适合这个项目：

- 系统依赖外部 academic / web search。
- embedding 和检索结果都有复用价值。
- 这是很实用的工程优化点。

---

## 最建议优先做的 3 个

如果目标是面试展示，不建议全部都做。最推荐优先做这三个：

### 第一优先：Agent Trace

最好讲，最能体现工程能力。

关键词：

```text
observability, reproducibility, debugging, agent trace
```

### 第二优先：Chunk-level Citation Grounding

最贴合当前 LanceDB RAG 改造。

关键词：

```text
grounded generation, evidence traceability, chunk citation
```

### 第三优先：Evaluation Pipeline

最像真正产品化 Agent，而不是 demo。

关键词：

```text
agent eval, retrieval hit rate, citation coverage, LLM-as-judge
```

---

## 面试时可以这样包装

可以这样介绍这个系统：

> 这是一个学术研究 Agent 系统，整体采用 planner-researcher-reporter 多阶段架构。Planner 负责拆解研究任务，Researcher 负责调用本地 RAG、学术搜索和 Web Search 收集证据，Reporter 基于 observations 和 sources 生成最终报告。为了提高可靠性，我进一步加入了 LanceDB 向量检索、chunk-level citation grounding、agent trace 和 eval pipeline，使系统不仅能生成结果，还能解释结果来自哪里、每一步做了什么、质量如何评估。

更短版本：

> 我做的不是一个简单聊天机器人，而是一个面向学术研究的多阶段 Agent。它有规划、检索、证据归因、报告生成和质量评估链路，并且通过 trace 和 eval 保证过程可观测、结果可追溯。

---

## 推荐实现路线

### Phase 1：先补可展示性

- Agent Trace
- 展示 planner / researcher / reporter 的中间结果
- 展示检索命中的 chunk 和 sources

目的：让面试官能直观看到系统不是黑盒。

### Phase 2：增强 RAG 可信度

- chunk-level citation
- citation coverage check
- Reporter 引用约束

目的：把 LanceDB 向量检索升级为可追溯证据链。

### Phase 3：加入评测闭环

- eval cases
- retrieval hit rate
- answer rubric scoring
- latency / cost 指标

目的：体现产品化和工程化能力。

### Phase 4：再讨论高级扩展

- hybrid search + rerank
- safe tool execution
- session memory
- cache

目的：作为面试讨论点，而不是一开始就全部实现。
