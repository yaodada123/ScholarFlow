import type { WorkflowState } from "./types.js";

export class ThreadStore {
  private readonly threads = new Map<string, WorkflowState>();

  get(threadId: string): WorkflowState | undefined {
    return this.threads.get(threadId);
  }

  set(state: WorkflowState): void {
    this.threads.set(state.threadId, state);
  }

  patch(threadId: string, patch: Partial<WorkflowState>): WorkflowState | undefined {
    const prev = this.threads.get(threadId);
    if (!prev) return undefined;
    const next: WorkflowState = { ...prev, ...patch };
    this.threads.set(threadId, next);
    return next;
  }
}

