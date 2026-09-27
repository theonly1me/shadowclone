import { z } from "zod";
import { actionSchema } from "./measurementSchema";
import { judgingSchema } from "./judgeEvidence";
import { validationSchema } from "./validationSchema";
import { sourceJudgingSchema } from "./sourceEvidenceSchema";
import { maintenanceSchema } from "./maintenance/schema";
import { comparisonSchema } from "./comparison/schema";

export const armSchema = z.enum(["bare", "skills", "memory", "clone"]);

export const arms = armSchema.options;

export const guidanceProtocols = [
  "guidance-v1",
  "guidance-v2",
  "guidance-skills-v1",
] as const;

export const dimensionSchema = z.enum([
  "preferences",
  "shared-memory",
  "additional-knowledge",
]);

export const criterionSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  dimension: dimensionSchema,
  requirement: z.string().min(1).max(2000),
  source: z.strictObject({ path: z.string().min(1), quote: z.string().min(1) }),
  check: z
    .enum(["judged", "zero-comments", "type-safety", "file-length"])
    .default("judged"),
});

export const scenarioSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  mode: z.enum(["code", "advice"]),
  pilot: z.boolean(),
  prompt: z.string().min(1).max(8000),
  completion: z.array(z.string().min(1)).min(1).max(8),
  criteria: z.array(criterionSchema).min(1).max(8),
  expectedSkills: z.array(z.string().min(1)),
  expectedReferences: z.array(z.string().min(1)),
});

export const scenariosSchema = z.strictObject({
  protocol: z.enum(guidanceProtocols),
  scenarios: z.array(scenarioSchema).length(4),
});

export const fileSchema = z.strictObject({
  relativePath: z.string(),
  content: z.string(),
  encoding: z.literal("base64").optional(),
  mode: z.number().int().min(0).max(511).optional(),
});

export const suiteSchema = z.strictObject({
  protocol: z.enum(guidanceProtocols),
  schemaVersion: z.literal(1),
  suiteId: z.uuid(),
  repository: z.string(),
  baseCommit: z.string(),
  context: z.array(fileSchema),
  maintainedContext: z.array(fileSchema).optional(),
  memory: z.array(fileSchema).min(1),
  memoryHashes: z
    .array(z.strictObject({ filename: z.string(), hash: z.string() }))
    .optional(),
  references: z.array(fileSchema),
  profile: z.string(),
  bootstrap: z.string(),
  sourcesFingerprint: z.string(),
  scenarios: z.array(scenarioSchema).length(4),
});

export const verdictSchema = z.enum(["pass", "fail", "unknown"]);

export const checkSchema = z.strictObject({
  id: z.string(),
  verdict: verdictSchema,
  evidence: z.string().max(1200),
});

export const voteSchema = z.strictObject({
  vote: z.number().int().min(1).max(3),
  checks: z.array(checkSchema),
});

export const traceSchema = z.strictObject({
  path: z.string(),
  beforeEdit: z.boolean().nullable(),
});

export const resultSchema = z.strictObject({
  scenarioId: z.string(),
  repeat: z.number().int().nonnegative(),
  arm: armSchema,
  resolvedModel: z.string(),
  evidence: z.string(),
  measurementVersion: z.literal(2).optional(),
  actions: z.array(actionSchema).optional(),
  reads: z.array(traceSchema),
  requiredSkills: z.array(
    z.strictObject({
      name: z.string(),
      loaded: z.boolean(),
      beforeEdit: z.boolean().nullable(),
    }),
  ),
  expectedReferences: z.array(
    z.strictObject({ path: z.string(), loaded: z.boolean() }),
  ),
  safety: z.enum(["pass", "fail"]),
  safetyEvidence: z.string(),
  verification: z.enum(["not-verified", "syntax-error", "pass", "fail"]),
  verificationEvidence: z.string().max(1200).optional(),
  deterministic: z.array(checkSchema),
  votes: z.array(voteSchema),
  complete: z.boolean(),
});

export const receiptSchema = z.strictObject({
  engine: z.enum(["claude-code", "codex"]).optional(),
  protocol: z.enum(guidanceProtocols),
  schemaVersion: z.literal(1),
  evalId: z.uuid(),
  suite: suiteSchema,
  suiteFingerprint: z.string(),
  model: z.string(),
  cliVersion: z.string().optional(),
  judging: z.union([judgingSchema, sourceJudgingSchema]).optional(),
  validation: validationSchema.optional(),
  maintenance: maintenanceSchema.optional(),
  comparison: comparisonSchema.optional(),
  effort: z.literal("medium"),
  pilot: z.boolean(),
  repeat: z.number().int().positive(),
  maximumCalls: z.number().int().positive().max(128),
  limitUsd: z.number().positive().max(50),
  deadlineAt: z.number(),
  status: z.enum(["ready", "running", "complete", "error"]),
  failure: z.string().nullable(),
  runs: z.array(resultSchema),
});

export type GuidanceArm = z.infer<typeof armSchema>;

export type GuidanceCriterion = z.infer<typeof criterionSchema>;

export type GuidanceScenario = z.infer<typeof scenarioSchema>;

export type GuidanceSuite = z.infer<typeof suiteSchema>;

export type GuidanceResult = z.infer<typeof resultSchema>;

export type GuidanceReceipt = z.infer<typeof receiptSchema>;

export type GuidanceCheck = z.infer<typeof checkSchema>;
