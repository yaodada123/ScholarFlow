import { z } from "zod";

export const ProjectRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const KnowledgeSourceKindSchema = z.enum(["paper", "web", "file", "note", "dataset", "other"]);

export const KnowledgeSourceRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  uri: z.string().min(1),
  kind: KnowledgeSourceKindSchema,
  description: z.string().optional().default(""),
  excerpt: z.string().optional().default(""),
  createdAt: z.string().datetime(),
});

export const CreateProjectSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().default(""),
});

export const AddKnowledgeSourceSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(500),
  uri: z.string().min(1).max(4000),
  kind: KnowledgeSourceKindSchema.optional().default("other"),
  description: z.string().max(8000).optional().default(""),
  excerpt: z.string().max(200_000).optional().default(""),
});

export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export type KnowledgeSourceKind = z.infer<typeof KnowledgeSourceKindSchema>;
export type KnowledgeSourceRecord = z.infer<typeof KnowledgeSourceRecordSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type AddKnowledgeSourceInput = z.infer<typeof AddKnowledgeSourceSchema>;
