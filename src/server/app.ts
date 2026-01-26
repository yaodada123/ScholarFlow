import "dotenv/config";

import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

import { ChatRequestSchema, type Resource } from "./schemas.js";
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
  ENABLE_MCP_SERVER_CONFIGURATION: z
    .preprocess((v) => {
      const s = typeof v === "string" ? v : v == null ? "" : String(v);
      return s.trim().toLowerCase() === "true" || s.trim() === "1";
    }, z.boolean())
    .optional()
    .default(false),
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

function applyCorsHeaders(origin: string | undefined, reply: FastifyReply): void {
  if (!origin) return;
  if (!allowedOrigins.includes(origin)) return;
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

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

app.options("/api/chat/stream", async (request: FastifyRequest, reply: FastifyReply) => {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
  applyCorsHeaders(origin, reply);
  reply.raw.statusCode = 204;
  reply.raw.end();
  return reply;
});

app.get("/healthz", async () => ({ ok: true }));

const threadStore = new ThreadStore();

const ragDir = path.resolve(process.cwd(), "data", "rag");

function toDetailError(message: string) {
  return { detail: message };
}

function sanitizeFilename(input: string): string {
  const base = path.basename(input ?? "").replaceAll("\0", "");
  const cleaned = base.replaceAll(/[\\/]/g, "_").trim();
  if (!cleaned) return "upload.txt";
  return cleaned.slice(0, 200);
}

function buildLocalResource(filename: string): Resource {
  const safeName = sanitizeFilename(filename);
  return { uri: `rag://local/${safeName}`, title: safeName, description: "" };
}

async function ensureRagDir(): Promise<void> {
  await mkdir(ragDir, { recursive: true });
}

function isAllowedRagFilename(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".md" || ext === ".txt";
}

const McpServerMetadataRequestSchema = z.discriminatedUnion("transport", [
  z.object({
    transport: z.literal("stdio"),
    command: z.string().min(1),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string(), z.string()).optional().default({}),
  }),
  z.object({
    transport: z.literal("sse"),
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional().default({}),
  }),
  z.object({
    transport: z.literal("streamable_http"),
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional().default({}),
  }),
]);

app.get("/api/config", async () => {
  const models = getConfiguredModels();
  const provider = (process.env.RAG_PROVIDER ?? "").trim() || "local";
  return {
    rag: { provider },
    models: {
      basic: models.basic ?? [],
      reasoning: models.reasoning ?? [],
      ...(models.vision ? { vision: models.vision } : {}),
      ...(models.code ? { code: models.code } : {}),
    },
  };
});

app.post("/api/mcp/server/metadata", async (request: FastifyRequest, reply: FastifyReply) => {
  if (!env.ENABLE_MCP_SERVER_CONFIGURATION) {
    reply
      .code(403)
      .send(
        toDetailError(
          "MCP server configuration is disabled. Set ENABLE_MCP_SERVER_CONFIGURATION=true to enable MCP features.",
        ),
      );
    return reply;
  }

  try {
    const parsed = McpServerMetadataRequestSchema.parse(request.body ?? {});
    reply.send({ ...parsed, tools: [] as unknown[] });
    return reply;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request body";
    reply.code(400).send(toDetailError(message));
    return reply;
  }
});

app.get("/api/rag/resources", async (request: FastifyRequest, reply: FastifyReply) => {
  await ensureRagDir();

  const query =
    typeof request.query === "object" && request.query && "query" in request.query
      ? String((request.query as Record<string, unknown>).query ?? "")
      : "";

  const entries = await readdir(ragDir, { withFileTypes: true });
  const all = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => isAllowedRagFilename(name))
    .map((name) => buildLocalResource(name));

  const q = query.trim().toLowerCase();
  const resources = q ? all.filter((r) => r.title.toLowerCase().includes(q)) : all;

  reply.send({ resources });
  return reply;
});

app.post("/api/rag/upload", async (request: FastifyRequest, reply: FastifyReply) => {
  await ensureRagDir();

  if (!request.isMultipart()) {
    reply.code(400).send(toDetailError("Expected multipart/form-data"));
    return reply;
  }

  const uploaded = await request.file();
  if (!uploaded) {
    reply.code(400).send(toDetailError("Missing file"));
    return reply;
  }

  const originalName = typeof uploaded.filename === "string" ? uploaded.filename : "upload.txt";
  const filename = sanitizeFilename(originalName);
  if (!isAllowedRagFilename(filename)) {
    reply.code(400).send(toDetailError("Only .md and .txt files are supported"));
    return reply;
  }

  const fullPath = path.join(ragDir, filename);
  const tmpPath = `${fullPath}.uploading`;

  try {
    const writeStream = createWriteStream(tmpPath, { flags: "w" });
    await pipeline(uploaded.file, writeStream);

    const info = await stat(tmpPath);
    if (info.size <= 0) {
      await unlink(tmpPath);
      reply.code(400).send(toDetailError("Cannot upload an empty file"));
      return reply;
    }

    await mkdir(path.dirname(fullPath), { recursive: true });
    await unlink(fullPath).catch(() => undefined);
    await rename(tmpPath, fullPath);

    reply.send(buildLocalResource(filename));
    return reply;
  } catch (e) {
    await unlink(tmpPath).catch(() => undefined);
    const message = e instanceof Error ? e.message : String(e);
    reply.code(500).send(toDetailError(message));
    return reply;
  }
});

app.post("/api/chat/stream", async (request: FastifyRequest, reply: FastifyReply) => {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
  applyCorsHeaders(origin, reply);
  setupSse(reply);

  let parsed;
  try {
    parsed = ChatRequestSchema.parse(request.body ?? {});
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid request body";
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    writeSseEvent(reply, { event: "error", data: JSON.stringify({ error: message }) });
  } finally {
    reply.raw.off("close", onClose);
    closeSse(reply);
  }
  return reply;
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
