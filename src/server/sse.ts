import type { FastifyReply } from "fastify";

export type SseEvent = {
  event?: string;
  data: string;
};

export function setupSse(reply: FastifyReply): void {
  reply.raw.statusCode = 200;
  reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
  reply.raw.flushHeaders();
}

export function writeSseEvent(reply: FastifyReply, event: SseEvent): void {
  if (event.event) {
    reply.raw.write(`event: ${event.event}\n`);
  }
  for (const line of event.data.split("\n")) {
    reply.raw.write(`data: ${line}\n`);
  }
  reply.raw.write("\n");
}

export function closeSse(reply: FastifyReply): void {
  reply.raw.end();
}
