import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Resource } from "../schemas.js";
import {
  AddKnowledgeSourceSchema,
  CreateProjectSchema,
  KnowledgeSourceRecordSchema,
  ProjectRecordSchema,
  type AddKnowledgeSourceInput,
  type CreateProjectInput,
  type KnowledgeSourceRecord,
  type ProjectRecord,
} from "./types.js";

export const projectsDir = path.resolve(process.cwd(), "data", "projects");

const PROJECT_FILENAME = "project.json";
const SOURCES_FILENAME = "sources.json";

export class KnowledgeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeNotFoundError";
  }
}

export class KnowledgeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeConflictError";
  }
}

export function sanitizeKnowledgeId(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120);
  return normalized || randomUUID();
}

export function projectDirectory(projectId: string, baseDir = projectsDir): string {
  const safeId = sanitizeKnowledgeId(projectId);
  if (safeId !== projectId) {
    throw new KnowledgeNotFoundError("Invalid project id");
  }
  return path.join(baseDir, safeId);
}

function sourceFile(projectId: string, baseDir: string): string {
  return path.join(projectDirectory(projectId, baseDir), SOURCES_FILENAME);
}

function projectFile(projectId: string, baseDir: string): string {
  return path.join(projectDirectory(projectId, baseDir), PROJECT_FILENAME);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function createProject(input: CreateProjectInput, options: { baseDir?: string; now?: Date } = {}): Promise<ProjectRecord> {
  const parsed = CreateProjectSchema.parse(input);
  const baseDir = options.baseDir ?? projectsDir;
  const id = sanitizeKnowledgeId(parsed.id ?? parsed.name);
  const now = (options.now ?? new Date()).toISOString();
  const filePath = projectFile(id, baseDir);
  const existing = await readJson<ProjectRecord | null>(filePath, null);
  if (existing) throw new KnowledgeConflictError("Project already exists");

  const project = ProjectRecordSchema.parse({
    id,
    name: parsed.name.trim(),
    description: parsed.description.trim(),
    createdAt: now,
    updatedAt: now,
  });

  await writeJson(filePath, project);
  await writeJson(sourceFile(id, baseDir), []);
  return project;
}

export async function listProjects(options: { baseDir?: string } = {}): Promise<ProjectRecord[]> {
  const baseDir = options.baseDir ?? projectsDir;
  await mkdir(baseDir, { recursive: true });
  const entries = await readdir(baseDir, { withFileTypes: true });
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const data = await readJson<ProjectRecord | null>(path.join(baseDir, entry.name, PROJECT_FILENAME), null);
          return data ? ProjectRecordSchema.parse(data) : null;
        } catch {
          return null;
        }
      }),
  );
  return projects
    .filter((project): project is ProjectRecord => Boolean(project))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProject(projectId: string, options: { baseDir?: string } = {}): Promise<ProjectRecord> {
  const baseDir = options.baseDir ?? projectsDir;
  const project = await readJson<ProjectRecord | null>(projectFile(projectId, baseDir), null);
  if (!project) throw new KnowledgeNotFoundError("Project not found");
  return ProjectRecordSchema.parse(project);
}

export async function listKnowledgeSources(projectId: string, options: { baseDir?: string } = {}): Promise<KnowledgeSourceRecord[]> {
  const baseDir = options.baseDir ?? projectsDir;
  await getProject(projectId, { baseDir });
  const sources = await readJson<KnowledgeSourceRecord[]>(sourceFile(projectId, baseDir), []);
  return sources.map((source) => KnowledgeSourceRecordSchema.parse(source)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addKnowledgeSource(
  projectId: string,
  input: AddKnowledgeSourceInput,
  options: { baseDir?: string; now?: Date } = {},
): Promise<KnowledgeSourceRecord> {
  const parsed = AddKnowledgeSourceSchema.parse(input);
  const baseDir = options.baseDir ?? projectsDir;
  await getProject(projectId, { baseDir });
  const sources = await readJson<KnowledgeSourceRecord[]>(sourceFile(projectId, baseDir), []);
  const id = sanitizeKnowledgeId(parsed.id ?? `${parsed.kind}-${parsed.title}`);
  if (sources.some((source) => source.id === id)) throw new KnowledgeConflictError("Knowledge source already exists");

  const source = KnowledgeSourceRecordSchema.parse({
    id,
    projectId,
    title: parsed.title.trim(),
    uri: parsed.uri.trim(),
    kind: parsed.kind,
    description: parsed.description.trim(),
    excerpt: parsed.excerpt.trim(),
    createdAt: (options.now ?? new Date()).toISOString(),
  });
  await writeJson(sourceFile(projectId, baseDir), [...sources, source]);
  return source;
}

export function knowledgeSourceToResource(source: KnowledgeSourceRecord): Resource {
  const description = [source.description, source.excerpt].filter(Boolean).join("\n\n");
  return {
    uri: source.uri,
    title: source.title,
    description,
  };
}
