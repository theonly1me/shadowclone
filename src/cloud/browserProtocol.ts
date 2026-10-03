import { z } from "zod";

export const setupPreviewInput = z.strictObject({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  name: z.string().trim().min(1).max(100),
  skills: z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .min(1)
    .max(40),
});
export const setupPreviewSchema = z.object({
  id: z.uuid(),
  repository: z.string(),
  repositoryId: z.number(),
  owner: z.string(),
  appOwner: z.string(),
  fingerprint: z.string(),
  bytes: z.number(),
  files: z.array(z.object({ path: z.string(), content: z.string() })),
});
export const setupStateSchema = z.object({
  repository: z.string().nullable(),
  skills: z.array(z.string()).default([]),
  app: z.object({ name: z.string(), installUrl: z.url() }).nullable(),
  pullUrl: z.url().nullable(),
});
export const manifestViewSchema = z.object({
  action: z.url(),
  manifest: z.string(),
});
export const previewApprovalSchema = z.strictObject({ previewId: z.uuid() });
export const activationInput = previewApprovalSchema.extend({
  token: z
    .string()
    .trim()
    .regex(/^sk-ant-oat01-[A-Za-z0-9_-]{20,500}$/),
});
