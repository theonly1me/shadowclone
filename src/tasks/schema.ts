import { z } from "zod";
import { verificationRecipeSchema } from "../harness/recipes";
import { workflowOutcomeSchema } from "../eval/shared/outcome";

export const taskActions = [
  "commit",
  "push",
  "pr-create",
  "pr-reply",
  "merge",
] as const;
export const taskActionSchema = z.enum(taskActions);
export const taskIdSchema = z.uuid();
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const taskHostSchema = z.enum(["claude-code", "codex"]);
export const taskScopeSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (value) =>
      value === "." ||
      (!value.startsWith("/") &&
        !value.startsWith("-") &&
        !value.includes("\\") &&
        value
          .split("/")
          .every((part) => part !== ".." && part !== "." && part !== "")),
    "Scopes must be repository-relative files or directories",
  );

export const startTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  host: taskHostSchema,
  hostVersion: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(200),
  acceptance: z.array(z.string().trim().min(1).max(2000)).min(1).max(32),
  scopes: z.array(taskScopeSchema).min(1).max(32).default(["."]),
  substantive: z.boolean().default(true),
  finish: z.enum(["review", "ship"]).default("review"),
  actions: z.array(taskActionSchema).max(5).default([]),
  verification: z.array(verificationRecipeSchema).max(32).default([]),
  parentId: taskIdSchema.optional(),
  dependencies: z.array(taskIdSchema).max(32).default([]),
});

export const workspaceSnapshotSchema = z.strictObject({
  head: z.string().regex(/^[a-f0-9]{40,64}$/),
  branch: z.string(),
  fingerprint: digestSchema,
  contentFingerprint: digestSchema,
  files: z.record(z.string(), digestSchema),
  dirty: z.boolean(),
});

export const guidanceSchema = z.strictObject({
  fingerprint: digestSchema,
  contextFingerprint: digestSchema,
  path: z.string(),
  repositoryRequirements: z.record(z.string(), digestSchema.nullable()),
  sources: z.array(
    z.strictObject({ path: z.string(), fingerprint: digestSchema.nullable() }),
  ),
  artifacts: z.array(
    z.strictObject({ path: z.string(), fingerprint: digestSchema }),
  ),
});

export const verificationCheckSchema = z.strictObject({
  name: z.string(),
  status: z.enum(["passed", "failed", "incomplete"]),
  evidence: z.string().max(8000),
});

export const taskReviewSchema = z.strictObject({
  sessionId: z.string().min(1).max(200),
  snapshot: digestSchema,
  guidance: digestSchema,
  acceptance: z
    .array(
      z.strictObject({
        criterion: z.string(),
        passed: z.boolean(),
        evidence: z.string().min(1).max(2000),
      }),
    )
    .max(32),
  standards: z.string().min(1).max(4000),
  passed: z.boolean(),
});

export const taskRecordSchema = z.strictObject({
  version: z.literal(1),
  id: taskIdSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  repositoryId: z.string(),
  repositoryDirectory: z.string(),
  commonDirectory: z.string(),
  worktree: z.string(),
  input: startTaskSchema,
  state: z.enum([
    "running",
    "verifying",
    "paused",
    "cancelled",
    "blocked",
    "review-ready",
    "done",
  ]),
  verificationOperation: z.uuid().nullable().optional(),
  baseline: workspaceSnapshotSchema,
  guidance: guidanceSchema,
  grantRevision: z.string().nullable(),
  gate: z.string().nullable(),
  harnessFingerprint: digestSchema.nullable(),
  recipes: z.array(verificationRecipeSchema).max(64),
  deliveries: z.array(
    z.strictObject({
      sessionId: z.string(),
      guidance: digestSchema,
      worktree: z.string(),
      at: z.string(),
      kind: z.literal("agent-acknowledged"),
    }),
  ),
  verification: z
    .strictObject({
      snapshot: workspaceSnapshotSchema,
      guidance: digestSchema,
      attempts: z.number().int().min(1).max(2),
      checks: z.array(verificationCheckSchema),
      status: z.enum(["passed", "failed", "incomplete"]),
      at: z.string(),
    })
    .nullable(),
  review: taskReviewSchema.nullable(),
  repairs: z.number().int().min(0).max(1),
  notes: z.array(z.string().max(4000)).max(100),
  actions: z
    .array(
      z.strictObject({
        id: z.uuid(),
        action: taskActionSchema,
        state: z.enum(["pending", "completed", "uncertain", "not-applied"]),
        head: z.string(),
        at: z.string(),
        request: z.string().max(70_000),
        result: z.string().max(8000),
      }),
    )
    .max(100),
  pullRequest: z.number().int().positive().nullable(),
  corrections: z.array(z.string()).max(100),
  outcome: workflowOutcomeSchema.optional(),
  integrations: z
    .array(
      z.strictObject({
        childId: taskIdSchema,
        childSnapshot: digestSchema,
        parentSnapshot: digestSchema,
      }),
    )
    .max(100)
    .optional(),
});

export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type StartTask = z.infer<typeof startTaskSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type TaskAction = z.infer<typeof taskActionSchema>;
export type VerificationCheck = z.infer<typeof verificationCheckSchema>;
