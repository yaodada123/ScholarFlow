# 📚 About ScholarFlow

> **A multi-agent assistant for academic research workflows**

**ScholarFlow** is a TypeScript-based academic Research Agent that helps users turn research questions into structured plans, retrieve evidence from local materials or optional web sources, and generate Markdown research reports.

The project focuses on controllable and observable agent workflows: planning before execution, human review before research, tool-call visibility, and evidence-aware report generation.

---

## 🌟 Project Focus

- Multi-agent workflow: Coordinator, Planner, Researcher, Reporter
- Human-in-the-loop plan review and editing
- Local academic RAG for Markdown/TXT papers, notes, and course materials
- Optional Web Search for background investigation
- SSE streaming for real-time agent messages and tool-call updates
- OpenAI-compatible model abstraction for flexible LLM providers

---

## 📜 License

This UI and the TypeScript implementation are distributed under the **MIT License**.

---

## 🙌 Acknowledgments

ScholarFlow is built on the broader open-source LLM ecosystem and inspired by modern deep-research style agents.

### Core Frameworks
- **[LangChain](https://github.com/langchain-ai/langchain)**: LLM interaction primitives.
- **[LangGraph](https://github.com/langchain-ai/langgraph)**: Multi-agent workflow orchestration.
- **[Next.js](https://nextjs.org/)**: Web application framework.

### UI Libraries
- **[Shadcn](https://ui.shadcn.com/)**: Minimalistic UI components.
- **[Zustand](https://zustand.docs.pmnd.rs/)**: State management.
- **[Framer Motion](https://www.framer.com/motion/)**: Animations.
- **[React Markdown](https://www.npmjs.com/package/react-markdown)**: Markdown rendering.
- **[SToneX](https://github.com/stonexer)**: Token-by-token visual effects.
