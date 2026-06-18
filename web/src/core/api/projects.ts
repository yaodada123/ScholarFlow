// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { resolveServiceURL } from "./resolve-service-url";

export type KnowledgeSourceKind = "paper" | "web" | "file" | "note" | "dataset" | "other";

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSourceRecord = {
  id: string;
  projectId: string;
  title: string;
  uri: string;
  kind: KnowledgeSourceKind;
  description: string;
  excerpt: string;
  createdAt: string;
};

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => null)) as { detail?: string } | null;
  throw new Error(body?.detail ?? `Request failed with HTTP ${response.status}`);
}

export async function listProjects(signal?: AbortSignal): Promise<ProjectRecord[]> {
  const response = await fetch(resolveServiceURL("projects"), { signal });
  const data = await readJson<{ projects: ProjectRecord[] }>(response);
  return data.projects;
}

export async function createProject(input: {
  id?: string;
  name: string;
  description?: string;
}): Promise<ProjectRecord> {
  const response = await fetch(resolveServiceURL("projects"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ project: ProjectRecord }>(response);
  return data.project;
}

export async function getProject(projectId: string, signal?: AbortSignal): Promise<ProjectRecord> {
  const response = await fetch(resolveServiceURL(`projects/${encodeURIComponent(projectId)}`), { signal });
  const data = await readJson<{ project: ProjectRecord }>(response);
  return data.project;
}

export async function listKnowledgeSources(projectId: string, signal?: AbortSignal): Promise<KnowledgeSourceRecord[]> {
  const response = await fetch(resolveServiceURL(`projects/${encodeURIComponent(projectId)}/sources`), { signal });
  const data = await readJson<{ sources: KnowledgeSourceRecord[] }>(response);
  return data.sources;
}

export async function addKnowledgeSource(
  projectId: string,
  input: {
    id?: string;
    title: string;
    uri: string;
    kind?: KnowledgeSourceKind;
    description?: string;
    excerpt?: string;
  },
): Promise<KnowledgeSourceRecord> {
  const response = await fetch(resolveServiceURL(`projects/${encodeURIComponent(projectId)}/sources`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ source: KnowledgeSourceRecord }>(response);
  return data.source;
}
