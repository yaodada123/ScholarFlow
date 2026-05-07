# 📚 关于 ScholarFlow

> **面向学术研究工作流的多智能体助手**

**ScholarFlow** 是一个基于 TypeScript 的学术 Research Agent，帮助用户将研究问题转化为结构化计划，结合本地资料或可选 Web Search 检索证据，并生成 Markdown 研究报告。

项目重点是构建可控、可观察的 Agent 工作流：先规划再执行，先审阅再研究，展示工具调用过程，并围绕证据生成报告。

---

## 🌟 项目重点

- 多智能体工作流：Coordinator、Planner、Researcher、Reporter
- Human-in-the-loop 计划审阅和编辑
- 本地学术 RAG，支持 Markdown/TXT 论文、笔记和课程资料
- 可选 Web Search，用于背景调研
- SSE 流式输出，实时展示 Agent 消息和工具调用
- OpenAI-compatible 模型抽象，便于切换不同 LLM 服务

---

## 📜 软件许可证

本 UI 与 TypeScript 实现均在 **MIT 许可证** 下分发。

---

## 🙌 致谢

ScholarFlow 基于开源 LLM 生态构建，并受到 Deep Research 类 Agent 产品形态的启发。

### 核心框架
- **[LangChain](https://github.com/langchain-ai/langchain)**：提供 LLM 交互基础能力。
- **[LangGraph](https://github.com/langchain-ai/langgraph)**：支持多智能体工作流编排。
- **[Next.js](https://nextjs.org/)**：用于构建 Web 应用。

### UI 库
- **[Shadcn](https://ui.shadcn.com/)**：简洁的 UI 组件。
- **[Zustand](https://zustand.docs.pmnd.rs/)**：状态管理。
- **[Framer Motion](https://www.framer.com/motion/)**：动画能力。
- **[React Markdown](https://www.npmjs.com/package/react-markdown)**：Markdown 渲染。
- **[SToneX](https://github.com/stonexer)**：逐字符视觉效果。
