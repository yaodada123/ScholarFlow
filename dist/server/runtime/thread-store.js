export class ThreadStore {
    threads = new Map();
    get(threadId) {
        return this.threads.get(threadId);
    }
    set(state) {
        this.threads.set(state.threadId, state);
    }
    patch(threadId, patch) {
        const prev = this.threads.get(threadId);
        if (!prev)
            return undefined;
        const next = { ...prev, ...patch };
        this.threads.set(threadId, next);
        return next;
    }
}
