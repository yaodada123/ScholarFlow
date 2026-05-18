import { appendFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
const replayRoot = path.resolve(process.cwd(), "data", "replays");
function sanitizePathSegment(value) {
    const cleaned = value.replaceAll("\0", "").replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
    return cleaned || "default";
}
function countJsonlEvents(content) {
    return content.split("\n").filter((line) => line.trim()).length;
}
function parseReplayEvents(content) {
    return content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
        try {
            const event = JSON.parse(line);
            if (!event || typeof event !== "object" || typeof event.type !== "string" || !event.data || typeof event.data !== "object") {
                return [];
            }
            return [event];
        }
        catch {
            return [];
        }
    });
}
function titleFromEvents(events) {
    for (const event of events) {
        if (event.type !== "message_chunk")
            continue;
        if (event.data.role !== "user")
            continue;
        const content = event.data.content;
        if (typeof content !== "string")
            continue;
        const title = content.replace(/\s+/g, " ").trim();
        if (title)
            return title.slice(0, 160);
    }
    return undefined;
}
async function summarizeReplayRun(threadId, filePath, fileName) {
    const [info, content] = await Promise.all([stat(filePath), readFile(filePath, "utf8").catch(() => "")]);
    const events = parseReplayEvents(content);
    const title = titleFromEvents(events);
    return {
        thread_id: threadId,
        run_id: fileName.slice(0, -".jsonl".length),
        updated_at: info.mtime.toISOString(),
        event_count: countJsonlEvents(content),
        ...(title ? { title } : {}),
    };
}
export class ReplayRecorder {
    runId;
    threadId;
    filePath;
    writeChain;
    constructor(params) {
        this.threadId = params.threadId;
        this.runId = params.runId;
        const safeThreadId = sanitizePathSegment(params.threadId);
        const safeRunId = sanitizePathSegment(params.runId);
        const dir = path.join(replayRoot, safeThreadId);
        this.filePath = path.join(dir, `${safeRunId}.jsonl`);
        this.writeChain = mkdir(dir, { recursive: true }).then(() => undefined);
    }
    static create(params) {
        return new ReplayRecorder(params);
    }
    record(event) {
        const line = `${JSON.stringify(event)}\n`;
        this.writeChain = this.writeChain
            .then(() => appendFile(this.filePath, line, "utf8"))
            .catch((error) => {
            console.warn("[replay] failed to write replay event", error);
        });
    }
    async flush() {
        await this.writeChain.catch(() => undefined);
    }
}
export async function listReplayRuns(threadId) {
    const dir = path.join(replayRoot, sanitizePathSegment(threadId));
    let entries;
    try {
        entries = await readdir(dir);
    }
    catch {
        return [];
    }
    const runs = await Promise.all(entries
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => summarizeReplayRun(threadId, path.join(dir, name), name)));
    return runs.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}
export async function listAllReplayRuns(params = {}) {
    const limit = Math.max(1, Math.min(200, params.limit ?? 50));
    let threadDirs;
    try {
        threadDirs = await readdir(replayRoot);
    }
    catch {
        return [];
    }
    const nested = await Promise.all(threadDirs.map(async (threadDir) => {
        const dir = path.join(replayRoot, threadDir);
        const info = await stat(dir).catch(() => null);
        if (!info?.isDirectory())
            return [];
        return await listReplayRuns(threadDir);
    }));
    return nested
        .flat()
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, limit);
}
export async function readReplayRun(threadId, runId) {
    const filePath = path.join(replayRoot, sanitizePathSegment(threadId), `${sanitizePathSegment(runId)}.jsonl`);
    const content = await readFile(filePath, "utf8");
    return parseReplayEvents(content);
}
export async function readLatestReplayRun(threadId) {
    const [latest] = await listReplayRuns(threadId);
    if (!latest)
        return null;
    return {
        thread_id: threadId,
        run_id: latest.run_id,
        events: await readReplayRun(threadId, latest.run_id),
    };
}
