import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { ChatRequestSchema } from "./schemas.js";
import { getConfiguredModels } from "./llm/env-models.js";
import { runChatWorkflow } from "./chat/run-chat-workflow.js";
import { ThreadStore } from "./runtime/thread-store.js";
import { closeSse, setupSse, writeSseEvent } from "./sse.js";
const EnvSchema = z.object({
    PORT: z.coerce.number().int().positive().default(8000),
    ALLOWED_ORIGINS: z
        .string()
        .optional()
        .default("http://localhost:3000,http://127.0.0.1:3000"),
});
const env = EnvSchema.parse(process.env);
const app = Fastify({
    logger: {
        level: process.env.DEBUG ? "debug" : "info",
    },
});
const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
function applyCorsHeaders(origin, reply) {
    if (!origin)
        return;
    if (!allowedOrigins.includes(origin))
        return;
    reply.raw.setHeader("Vary", "Origin");
    reply.raw.setHeader("Access-Control-Allow-Origin", origin);
    reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
    reply.raw.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Authorization");
    reply.raw.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
await app.register(cors, {
    origin: (origin, cb) => {
        if (!origin) {
            cb(null, true);
            return;
        }
        cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Cache-Control", "Authorization"],
});
app.options("/api/chat/stream", async (request, reply) => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    applyCorsHeaders(origin, reply);
    reply.raw.statusCode = 204;
    reply.raw.end();
    return reply;
});
app.get("/healthz", async () => ({ ok: true }));
const threadStore = new ThreadStore();
app.get("/api/config", async () => {
    const models = getConfiguredModels();
    return {
        rag: { provider: process.env.RAG_PROVIDER ?? "" },
        models: {
            basic: models.basic ?? [],
            reasoning: models.reasoning ?? [],
            ...(models.vision ? { vision: models.vision } : {}),
            ...(models.code ? { code: models.code } : {}),
        },
    };
});
app.post("/api/chat/stream", async (request, reply) => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    applyCorsHeaders(origin, reply);
    setupSse(reply);
    let parsed;
    try {
        parsed = ChatRequestSchema.parse(request.body ?? {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request body";
        writeSseEvent(reply, {
            event: "error",
            data: JSON.stringify({ error: message }),
        });
        closeSse(reply);
        return reply;
    }
    const abortController = new AbortController();
    const onClose = () => abortController.abort();
    reply.raw.on("close", onClose);
    try {
        for await (const event of runChatWorkflow({
            request: parsed,
            store: threadStore,
            signal: abortController.signal,
        })) {
            writeSseEvent(reply, { event: event.type, data: JSON.stringify(event.data) });
        }
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeSseEvent(reply, { event: "error", data: JSON.stringify({ error: message }) });
    }
    finally {
        reply.raw.off("close", onClose);
        closeSse(reply);
    }
    return reply;
});
await app.listen({ port: env.PORT, host: "0.0.0.0" });
