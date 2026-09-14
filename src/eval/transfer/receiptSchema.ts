import { z } from "zod";
import { judgingSchema } from "./judgingSchema";
import {
  checkVerdictSchema,
  dependencyModeSchema,
  dependencyStateSchema,
  preferenceVerdictSchema,
  reasoningEffortSchema,
} from "./structured";

const checkSchema = z.strictObject({
  requirement: z.string().min(1),
  verdict: checkVerdictSchema,
  evidence: z.string(),
  votes: z.array(z.strictObject({
    verdict: checkVerdictSchema,
    evidence: z.string(),
  })),
});

const preferenceResultSchema = checkSchema.extend({
  verdict: preferenceVerdictSchema,
  votes: z.array(z.strictObject({
    verdict: preferenceVerdictSchema,
    evidence: z.string(),
  })),
});

const contextSchema = z.strictObject({
  relativePath: z.string().min(1),
  content: z.string(),
});

const profileSnapshotSchema = z.strictObject({
  kind: z.literal("current"),
  fingerprint: z.string().min(1),
  ruleCount: z.number().int().positive(),
});

const taskSchema = z.strictObject({
  id: z.string().min(1),
  startingCommit: z.string().min(1),
  prompt: z.string().min(1),
  completion: z.array(z.string().min(1)).min(1),
  preferences: z.array(
    z.strictObject({
      requirement: z.string().min(1),
      rubric: z.strictObject({
        version: z.union([z.literal(1), z.literal(2)]),
        id: z.string().min(1),
        fingerprint: z.string().min(1),
        interpretation: z.string().min(1).optional(),
        scope: z.literal("changed-code-and-tests"),
        override: z.string(),
      }).optional(),
      source: z.strictObject({
        relativePath: z.string().min(1),
        heading: z.string(),
        line: z.number().int().positive(),
      }),
    }),
  ).min(1),
  profile: z.string().min(1),
  profileFingerprint: z.string().min(1),
});

export const evaluationSuiteSchema = z.strictObject({
  schemaVersion: z.literal(3),
  suiteId: z.uuid(),
  repository: z.string().min(1),
  baseCommit: z.string().min(1),
  context: z.array(contextSchema),
  profileSnapshot: profileSnapshotSchema,
  tasks: z.array(taskSchema).min(1),
});

const runSchema = z.strictObject({
  taskId: z.string().min(1),
  repeat: z.number().int().nonnegative(),
  arm: z.enum(["bare", "skills", "clone"]),
  phase: z.enum(["evidence", "complete"]),
  sessionId: z.string().nullable(),
  failure: z.string().nullable(),
  failureStage: z.enum(["execution", "judging"]).nullable().optional(),
  judging: judgingSchema.optional(),
  durationMs: z.number().nonnegative(),
  costUsd: z.number().nullable(),
  dependencyState: dependencyStateSchema.nullable(),
  observed: z.string().nullable(),
  verification: z.array(checkSchema),
  safety: z.array(checkSchema),
  correctness: z.array(checkSchema),
  preferences: z.array(preferenceResultSchema),
});

const progressSchema = z.strictObject({
  stage: z.enum([
    "ready",
    "snapshot",
    "coding",
    "collecting",
    "safety",
    "judging",
    "timeout",
    "complete",
    "error",
  ]),
  taskIndex: z.number().int().positive().nullable(),
  taskCount: z.number().int().positive(),
  repeatIndex: z.number().int().positive().nullable(),
  repeatCount: z.number().int().positive(),
  arm: z.enum(["bare", "skills", "clone"]).nullable(),
  voteIndex: z.number().int().positive().nullable(),
  voteCount: z.number().int().positive().nullable(),
  updatedAt: z.iso.datetime(),
});

const preparedSchema = z.strictObject({
  schemaVersion: z.literal(12),
  evalId: z.uuid(),
  suiteId: z.uuid(),
  repository: z.string().min(1),
  baseCommit: z.string().min(1),
  engine: z.enum(["codex", "claude-code"]),
  model: z.string().min(1),
  reasoningEffort: reasoningEffortSchema.nullable(),
  dependencyMode: dependencyModeSchema,
  repeat: z.number().int().positive(),
  timeoutSeconds: z.number().positive(),
  maxBudgetUsd: z.number().nullable(),
  dirtyFileCount: z.number().int().nonnegative(),
  context: z.array(contextSchema),
  profileSnapshot: profileSnapshotSchema,
  preflight: z.array(checkSchema).min(1),
  tasks: z.array(taskSchema).min(1),
});

export const receiptSchema = z.strictObject({
  schemaVersion: z.literal(12),
  evalId: z.uuid(),
  status: z.enum(["running", "complete", "pass", "fail", "error"]),
  preparedFingerprint: z.string().min(1),
  runs: z.array(runSchema),
  progress: progressSchema.nullable(),
  prepared: preparedSchema,
  limitations: z.array(z.string()),
});
