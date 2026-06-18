import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AddKnowledgeSourceSchema, CreateProjectSchema, KnowledgeSourceRecordSchema, ProjectRecordSchema, } from "./types.js";
export const projectsDir = path.resolve(process.cwd(), "data", "projects");
const PROJECT_FILENAME = "project.json";
const SOURCES_FILENAME = "sources.json";
export class KnowledgeNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "KnowledgeNotFoundError";
    }
}
export class KnowledgeConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "KnowledgeConflictError";
    }
}
export function sanitizeKnowledgeId(input) {
    const normalized = input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^[._-]+|[._-]+$/g, "")
        .slice(0, 120);
    return normalized || randomUUID();
}
export function projectDirectory(projectId, baseDir = projectsDir) {
    const safeId = sanitizeKnowledgeId(projectId);
    if (safeId !== projectId) {
        throw new KnowledgeNotFoundError("Invalid project id");
    }
    return path.join(baseDir, safeId);
}
function sourceFile(projectId, baseDir) {
    return path.join(projectDirectory(projectId, baseDir), SOURCES_FILENAME);
}
function projectFile(projectId, baseDir) {
    return path.join(projectDirectory(projectId, baseDir), PROJECT_FILENAME);
}
async function readJson(filePath, fallback) {
    try {
        return JSON.parse(await readFile(filePath, "utf8"));
    }
    catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "ENOENT")
            return fallback;
        throw error;
    }
}
async function writeJson(filePath, data) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
export async function createProject(input, options = {}) {
    const parsed = CreateProjectSchema.parse(input);
    const baseDir = options.baseDir ?? projectsDir;
    const id = sanitizeKnowledgeId(parsed.id ?? parsed.name);
    const now = (options.now ?? new Date()).toISOString();
    const filePath = projectFile(id, baseDir);
    const existing = await readJson(filePath, null);
    if (existing)
        throw new KnowledgeConflictError("Project already exists");
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
export async function listProjects(options = {}) {
    const baseDir = options.baseDir ?? projectsDir;
    await mkdir(baseDir, { recursive: true });
    const entries = await readdir(baseDir, { withFileTypes: true });
    const projects = await Promise.all(entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
        try {
            const data = await readJson(path.join(baseDir, entry.name, PROJECT_FILENAME), null);
            return data ? ProjectRecordSchema.parse(data) : null;
        }
        catch {
            return null;
        }
    }));
    return projects
        .filter((project) => Boolean(project))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getProject(projectId, options = {}) {
    const baseDir = options.baseDir ?? projectsDir;
    const project = await readJson(projectFile(projectId, baseDir), null);
    if (!project)
        throw new KnowledgeNotFoundError("Project not found");
    return ProjectRecordSchema.parse(project);
}
export async function listKnowledgeSources(projectId, options = {}) {
    const baseDir = options.baseDir ?? projectsDir;
    await getProject(projectId, { baseDir });
    const sources = await readJson(sourceFile(projectId, baseDir), []);
    return sources.map((source) => KnowledgeSourceRecordSchema.parse(source)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function addKnowledgeSource(projectId, input, options = {}) {
    const parsed = AddKnowledgeSourceSchema.parse(input);
    const baseDir = options.baseDir ?? projectsDir;
    await getProject(projectId, { baseDir });
    const sources = await readJson(sourceFile(projectId, baseDir), []);
    const id = sanitizeKnowledgeId(parsed.id ?? `${parsed.kind}-${parsed.title}`);
    if (sources.some((source) => source.id === id))
        throw new KnowledgeConflictError("Knowledge source already exists");
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
export function knowledgeSourceToResource(source) {
    const description = [source.description, source.excerpt].filter(Boolean).join("\n\n");
    return {
        uri: source.uri,
        title: source.title,
        description,
    };
}
