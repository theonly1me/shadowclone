import { z } from "zod";

export const referenceDeltaSchema = z.strictObject({
  path: z.string(),
  relativePath: z.string(),
  beforeHash: z.string(),
  afterHash: z.string(),
  updatedAt: z.string(),
  revisionId: z.uuid(),
  verifiedCommit: z.string(),
  verifiedPath: z.string(),
});

export const maintenanceManifestSchema = z.strictObject({
  version: z.literal(1),
  parentEvalId: z.uuid(),
  parentSuiteFingerprint: z.string(),
  suiteFingerprint: z.string(),
  delta: referenceDeltaSchema,
});

export type MaintenanceManifest = z.infer<typeof maintenanceManifestSchema>;

export const maintenanceSchema = z.strictObject({
  version: z.literal(1),
  parentEvalId: z.uuid(),
  parentReceiptFingerprint: z.string(),
  parentBudgetFingerprint: z.string(),
  originalReceiptFingerprint: z.string(),
  originalBudgetFingerprint: z.string(),
  priorSpentUsd: z.number().nonnegative(),
  priorCalls: z.number().int().nonnegative(),
  additionalLimitUsd: z.number().positive().max(10),
  resolvedModel: z.literal("claude-sonnet-5"),
  windowSeconds: z.number().int().positive().max(2700),
  manifest: maintenanceManifestSchema,
});
