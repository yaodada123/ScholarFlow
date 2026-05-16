import "dotenv/config";

import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

import { ChatRequestSchema } from "./schemas.js";
import { evaluateReportDeterministic, parseLlmEvaluation } from "./evaluation/report-evaluator.js";
import { getConfiguredModels, loadLlmConfig } from "./llm/env-models.js";
import { OpenAICompatibleClient } from "./llm/openai-compatible.js";
import { runChatWorkflow } from "./chat/run-chat-workflow.js";
import { ThreadStore } from "./runtime/thread-store.js";
import { closeSse, setupSse, writeSseEvent } from "./sse.js";
import { isLanceDbEnabled } from "./rag/config.js";
import { buildLocalResource, extractTextFromRagFile, isAllowedRagFilename, RagTextExtractionError, ragDir, sanitizeRagFilename } from "./rag/document-text.js";
import { indexLocalResource } from "./rag/lancedb-store.js";
import { listTraceRuns, readLatestTraceRun, readTraceRun, TraceRecorder } from "./trace/recorder.js";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8899),
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .default("http://localhost:3300,http://127.0.0.1:3300"),
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

const imageUploadLimit = 20 * 1024 * 1024;
app.addContentTypeParser(/^image\/.*$/i, { parseAs: "buffer", bodyLimit: imageUploadLimit }, (_request, body, done) => {
  done(null, body);
});
app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: imageUploadLimit }, (_request, body, done) => {
  done(null, body);
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

function toDetailError(message: string) {
  return { detail: message };
}

function sanitizeFilename(input: string): string {
  const base = path.basename(input ?? "").replaceAll("\0", "");
  const cleaned = base.replaceAll(/[\\/]/g, "_").trim();
  if (!cleaned) return "upload.txt";
  return cleaned.slice(0, 200);
}

async function ensureRagDir(): Promise<void> {
  await mkdir(ragDir, { recursive: true });
}

const uploadDir = path.resolve(process.cwd(), "data", "uploads");

const PromptEnhanceRequestSchema = z.object({
  prompt: z.string().min(1),
  context: z.string().optional(),
  report_style: z.string().optional(),
});

const ReportEvaluateRequestSchema = z.object({
  content: z.string().min(1),
  query: z.string().optional().default(""),
  report_style: z.string().optional().default("default"),
  use_llm: z.boolean().optional().default(false),
});

const ProseGenerateRequestSchema = z.object({
  prompt: z.string().min(1),
  option: z.string().optional(),
  command: z.string().optional(),
});

function stripThinkTags(text: string): string {
  return text.replaceAll("<think>", "").replaceAll("</think>", "");
}

function fallbackEnhancedPrompt(params: { prompt: string; context?: string; reportStyle?: string }): string {
  const style = params.reportStyle ? `\nReport style: ${params.reportStyle}` : "";
  const context = params.context ? `\nContext: ${params.context}` : "";
  return [
    params.prompt.trim(),
    "",
    "Please turn this into a focused academic research request. Clarify the topic scope, target audience, evidence requirements, expected output structure, and any key constraints.",
    "The final answer should include candidate topic directions, core research questions, feasibility, novelty, evidence review, limitations, and references when available.",
    `${style}${context}`.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

async function collectLlmText(params: {
  system: string;
  user: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<string | null> {
  const cfg = loadLlmConfig("basic") ?? loadLlmConfig("reasoning");
  if (!cfg) return null;
  const llm = new OpenAICompatibleClient({ ...cfg, ...(params.timeoutMs ? { timeoutMs: params.timeoutMs } : {}) });
  let text = "";
  for await (const delta of llm.streamChatCompletions({
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    ...(params.signal ? { signal: params.signal } : {}),
  })) {
    if (delta.content) text += stripThinkTags(delta.content);
  }
  return text.trim() || null;
}

function buildProseInstruction(option: string | undefined, command: string | undefined): string {
  if (command?.trim()) return `Follow this editing instruction: ${command.trim()}`;
  if (option === "improve") return "Improve the writing while preserving the original meaning.";
  if (option === "shorter") return "Make the text shorter while preserving the key points.";
  if (option === "longer") return "Expand the text with useful detail while preserving the original direction.";
  if (option === "continue") return "Continue the text naturally.";
  if (option === "zap") return "Rewrite the text according to the user's implied instruction.";
  return "Improve the text for clarity, structure, and usefulness.";
}

function isAllowedImageFilename(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".gif" || ext === ".webp";
}

function imageContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function requestOrigin(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = typeof forwardedProto === "string" ? forwardedProto.split(",")[0]?.trim() : undefined;
  const protocol = proto || (request.protocol || "http");
  const host = request.headers.host ?? `localhost:${env.PORT}`;
  return `${protocol}://${host}`;
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

app.post("/api/prompt/enhance", async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parsed = PromptEnhanceRequestSchema.parse(request.body ?? {});
    const fallback = fallbackEnhancedPrompt({
      prompt: parsed.prompt,
      ...(parsed.context ? { context: parsed.context } : {}),
      ...(parsed.report_style ? { reportStyle: parsed.report_style } : {}),
    });
    const enhanced =
      (await collectLlmText({
        system:
          "You improve academic research prompts. Return only the enhanced prompt text, no markdown fences and no JSON.",
        user:
          `Original prompt:\n${parsed.prompt}\n\n` +
          `Report style: ${parsed.report_style ?? "academic"}\n` +
          `${parsed.context ? `Context:\n${parsed.context}\n\n` : ""}` +
          "Make it specific, evidence-oriented, and suitable for generating topic directions plus a research report.",
      }).catch(() => null)) ?? fallback;

    reply.send({ result: enhanced, enhanced_prompt: enhanced });
    return reply;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid prompt enhancement request";
    reply.code(400).send(toDetailError(message));
    return reply;
  }
});

app.post("/api/report/evaluate", async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parsed = ReportEvaluateRequestSchema.parse(request.body ?? {});
    const result = evaluateReportDeterministic(parsed.content);

    if (parsed.use_llm) {
      const llmText = await collectLlmText({
        system:
          "You are a strict academic report evaluator. Output ONLY valid JSON matching the requested schema.",
        user:
          "Evaluate the report from 0 to 10. Return JSON with scores {factual_accuracy, completeness, coherence, relevance, citation_quality, writing_quality}, overall_score, weighted_score, strengths, weaknesses, suggestions.\n\n" +
          `Research query: ${parsed.query}\nReport style: ${parsed.report_style}\n\nReport:\n${parsed.content.slice(0, 40_000)}`,
        timeoutMs: 120000,
      }).catch(() => null);
      const llmEvaluation = llmText ? parseLlmEvaluation(llmText) : null;
      if (llmEvaluation) {
        result.llm_evaluation = llmEvaluation;
        result.score = Math.round(((result.score + llmEvaluation.weighted_score) / 2) * 10) / 10;
        result.grade = result.score >= 9.5 ? "A+" : result.score >= 9 ? "A" : result.score >= 8 ? "A-" : result.score >= 7.5 ? "B+" : result.score >= 7 ? "B" : result.score >= 6.5 ? "B-" : result.score >= 6 ? "C+" : result.score >= 5 ? "C" : result.score >= 4 ? "D" : "F";
      }
    }

    reply.send(result);
    return reply;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid report evaluation request";
    reply.code(400).send(toDetailError(message));
    return reply;
  }
});

app.options("/api/prose/generate", async (request: FastifyRequest, reply: FastifyReply) => {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
  applyCorsHeaders(origin, reply);
  reply.raw.statusCode = 204;
  reply.raw.end();
  return reply;
});

app.post("/api/prose/generate", async (request: FastifyRequest, reply: FastifyReply) => {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
  applyCorsHeaders(origin, reply);
  setupSse(reply);

  try {
    const parsed = ProseGenerateRequestSchema.parse(request.body ?? {});
    const cfg = loadLlmConfig("basic") ?? loadLlmConfig("reasoning");
    if (!cfg) {
      writeSseEvent(reply, { data: parsed.prompt });
      return reply;
    }

    const llm = new OpenAICompatibleClient(cfg);
    const instruction = buildProseInstruction(parsed.option, parsed.command);
    for await (const delta of llm.streamChatCompletions({
      messages: [
        { role: "system", content: "You are an academic writing editor. Return only the edited prose text." },
        { role: "user", content: `${instruction}\n\nText:\n${parsed.prompt}` },
      ],
    })) {
      if (!delta.content) continue;
      const cleaned = stripThinkTags(delta.content);
      if (cleaned) writeSseEvent(reply, { data: cleaned });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    writeSseEvent(reply, { data: `Unable to generate prose: ${message}` });
  } finally {
    closeSse(reply);
  }
  return reply;
});

app.post("/api/upload", async (request: FastifyRequest, reply: FastifyReply) => {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    reply.code(400).send(toDetailError("Only image uploads are supported"));
    return reply;
  }

  const body = request.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    reply.code(400).send(toDetailError("Missing image body"));
    return reply;
  }

  const originalName = typeof request.headers["x-vercel-filename"] === "string" ? request.headers["x-vercel-filename"] : "image.png";
  const safeName = sanitizeFilename(originalName);
  if (!isAllowedImageFilename(safeName)) {
    reply.code(400).send(toDetailError("Only .png, .jpg, .jpeg, .gif, and .webp images are supported"));
    return reply;
  }

  await mkdir(uploadDir, { recursive: true });
  const filename = `${randomUUID()}-${safeName}`;
  await writeFile(path.join(uploadDir, filename), body);
  reply.send({ url: `${requestOrigin(request)}/api/uploads/${encodeURIComponent(filename)}` });
  return reply;
});

app.get("/api/uploads/:filename", async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as Record<string, unknown>;
  const filename = sanitizeFilename(String(params.filename ?? ""));
  if (!filename || !isAllowedImageFilename(filename)) {
    reply.code(404).send(toDetailError("File not found"));
    return reply;
  }

  try {
    const data = await readFile(path.join(uploadDir, filename));
    reply.header("Content-Type", imageContentType(filename));
    reply.send(data);
    return reply;
  } catch {
    reply.code(404).send(toDetailError("File not found"));
    return reply;
  }
});

app.post("/api/podcast/generate", async (_request: FastifyRequest, reply: FastifyReply) => {
  reply.code(501).send(toDetailError("Podcast generation requires a configured TTS provider and is not enabled in this backend."));
  return reply;
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
  const filename = sanitizeRagFilename(originalName);
  if (!isAllowedRagFilename(filename)) {
    reply.code(400).send(toDetailError("Only .md, .txt, and text-based .pdf files are supported"));
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

    let extractedText = "";
    try {
      extractedText = (await extractTextFromRagFile(tmpPath, filename)).text;
    } catch (e) {
      await unlink(tmpPath).catch(() => undefined);
      const message = e instanceof Error ? e.message : String(e);
      const status = e instanceof RagTextExtractionError ? 400 : 500;
      reply.code(status).send(toDetailError(message));
      return reply;
    }

    await mkdir(path.dirname(fullPath), { recursive: true });
    await unlink(fullPath).catch(() => undefined);
    await rename(tmpPath, fullPath);

    const resource = buildLocalResource(filename);
    if (isLanceDbEnabled()) {
      try {
        await indexLocalResource({
          filename,
          uri: resource.uri,
          title: resource.title,
          description: resource.description,
          extractedText,
        });
      } catch (e) {
        app.log.warn({ err: e, filename }, "Failed to index RAG upload; local fallback remains available");
      }
    }

    reply.send(resource);
    return reply;
  } catch (e) {
    await unlink(tmpPath).catch(() => undefined);
    const message = e instanceof Error ? e.message : String(e);
    reply.code(500).send(toDetailError(message));
    return reply;
  }
});

app.get("/api/traces/:threadId/latest", async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as Record<string, unknown>;
  const threadId = String(params.threadId ?? "");
  if (!threadId) {
    reply.code(400).send(toDetailError("Missing thread id"));
    return reply;
  }

  const latest = await readLatestTraceRun(threadId);
  if (!latest) {
    reply.code(404).send(toDetailError("Trace not found"));
    return reply;
  }

  reply.send(latest);
  return reply;
});

app.get("/api/traces/:threadId/:runId", async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as Record<string, unknown>;
  const threadId = String(params.threadId ?? "");
  const runId = String(params.runId ?? "");
  if (!threadId || !runId) {
    reply.code(400).send(toDetailError("Missing trace parameters"));
    return reply;
  }

  try {
    const events = await readTraceRun(threadId, runId);
    reply.send({ thread_id: threadId, run_id: runId, events });
    return reply;
  } catch {
    reply.code(404).send(toDetailError("Trace not found"));
    return reply;
  }
});

app.get("/api/traces/:threadId", async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as Record<string, unknown>;
  const threadId = String(params.threadId ?? "");
  if (!threadId) {
    reply.code(400).send(toDetailError("Missing thread id"));
    return reply;
  }

  reply.send({ thread_id: threadId, runs: await listTraceRuns(threadId) });
  return reply;
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

  const trace = TraceRecorder.create({ threadId: parsed.thread_id });

  try {
    for await (const event of runChatWorkflow({
      request: parsed,
      store: threadStore,
      signal: abortController.signal,
      trace,
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
