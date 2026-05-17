# ScholarFlow 迭代变更记录

本文档用于持久记录每次功能迭代的变更点，便于后续回顾、验收和继续迁移 DeerFlow 能力。

## 记录格式

每次迭代建议按以下结构追加：

```md
## YYYY-MM-DD — 迭代标题

### 目标
- 本次迭代要解决的问题或迁移的能力。

### 功能变更
- 用户可感知的功能点。

### 技术变更
- 后端、前端、数据结构、API、配置等实现层变更。

### 验证情况
- 已运行的检查、测试、构建和手动验证结果。

### 后续建议
- 下一步可继续做的增强项。
```

---

## 2026-05-17 — 复刻 DeerFlow Academic Skills MVP

### 目标
- 从官方 `deer-flow` 中选择最适合 ScholarFlow 当前阶段迁移的能力。
- 第一轮不复刻完整平台运行时，而是迁移更轻量、收益更直接的 Skills 机制。
- 将 DeerFlow 的学术技能方法论改造成 ScholarFlow 的 TypeScript 原生 prompt-level 能力。

### 功能变更
- 新增 Academic Skills 能力，内置三个学术技能：
  - `systematic-literature-review`：文献综述、survey、annotated bibliography、跨论文综合。
  - `academic-paper-review`：单篇论文、arXiv、PDF、审稿式分析。
  - `deep-research`：多角度调研、对比、解释和证据综合。
- 后端支持自动选择技能：
  - “文献综述 / systematic review / literature review / survey”等触发文献综述技能。
  - “review this paper / peer review / arxiv.org/abs / 审稿”等触发论文评审技能。
  - “调研 / research / compare / explain”等触发深度研究技能。
- 前端 Settings 增加 Academic Skills 配置：
  - 可开启/关闭 skills。
  - 可手动勾选一个或多个技能。
  - 不勾选时由后端自动选择；勾选后强制注入所选技能。
- 新增 `GET /api/skills`，用于返回内置 skills 元数据。

### 技术变更
- 新增后端 skills domain：
  - `src/server/skills/types.ts`
  - `src/server/skills/registry.ts`
  - `src/server/skills/selector.ts`
  - `src/server/skills/prompt.ts`
- 扩展后端 chat schema：
  - `enable_skills`
  - `selected_skills`
- 扩展 workflow state：
  - `activeSkills`
  - `skillSelectionReason`
- 在 `run-chat-workflow.ts` 中接入技能选择和 trace 记录：
  - `active_skills`
  - `skill_selection_reason`
- 在 planner、researcher、reporter 中注入对应阶段的 skill guidance。
- 对 `systematic-literature-review` 自动提高 academic search 数量到 10–20 条。
- 前端设置链路更新：
  - `web/src/core/store/settings-store.ts`
  - `web/src/core/api/chat.ts`
  - `web/src/core/store/store.ts`
  - `web/src/app/settings/tabs/general-tab.tsx`
- 后端 build 后同步生成了 `dist/server/skills/*` 及相关 `dist/server/*` 产物。

### 验证情况
- 已安装依赖：
  - 后端：`npm install`
  - 前端：`pnpm install`
- 已通过：
  - `npm --prefix ScholarFlow run typecheck`
  - `npm --prefix ScholarFlow run build`
  - `pnpm --dir ScholarFlow/web run typecheck`
  - `pnpm --dir ScholarFlow/web run test:run`，共 127 个测试通过。
  - 对本次改动文件执行 targeted ESLint，通过。
  - `git diff --check` 通过。
- 未完全通过：
  - full lint 存在仓库既有问题，涉及若干非本次改动文件，例如 `agent-trace-block.tsx`、`input-box.tsx`、`about-tab.tsx` 等。
- 未执行：
  - 浏览器端真实 UI 手动验证。建议本地运行 `npm run dev:all` 后，在 Settings 中检查 Academic Skills 开关和勾选项。

### 后续建议
- 增加 skills selector 的单元测试，覆盖中英文触发词和手动选择优先级。
- 给 trace UI 展示 active skills，便于排查为什么某次请求采用了特定输出结构。
- 第二阶段可迁移 DeerFlow 的轻量 Memory / Dynamic Context。
- 第三阶段可考虑持久化 Thread/Run 和 Artifact 系统。
- 暂不建议直接迁移完整 MCP、Subagents、Sandbox，避免过早重构 ScholarFlow 架构。
