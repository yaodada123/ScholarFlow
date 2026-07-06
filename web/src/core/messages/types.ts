// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

export type MessageRole = "user" | "assistant" | "tool";

export interface Message {
  id: string;
  threadId: string;
  agent?:
    | "coordinator"
    | "planner"
    | "researcher"
    | "coder"
    | "reporter"
    | "analyst";
  role: MessageRole;
  isStreaming?: boolean;
  content: string;
  contentChunks: string[];
  reasoningContent?: string;
  reasoningContentChunks?: string[];
  toolCalls?: ToolCallRuntime[];
  options?: Option[];
  finishReason?: "stop" | "interrupt" | "tool_calls";
  interruptFeedback?: string;
  resources?: Array<Resource>;
  reportVersions?: ReportVersion[];
}

export interface ReportVersion {
  id: string;
  content: string;
  label: string;
  createdAt: string;
  source: "generated" | "optimized";
  evaluation?: ReportVersionEvaluation;
  previousEvaluation?: ReportVersionEvaluation;
  improvementPlan?: string[];
  diff?: ReportLineDiff[];
}

export interface ReportVersionEvaluation {
  score: number;
  grade: string;
}

export interface ReportLineDiff {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export interface Option {
  text: string;
  value: string;
}

export interface ToolCallRuntime {
  id: string;
  name: string;
  args: Record<string, unknown>;
  argsChunks?: string[];
  result?: string;
}

export interface Resource {
  uri: string;
  title: string;
  description?: string;
}
