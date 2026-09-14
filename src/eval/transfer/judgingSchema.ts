import { z } from "zod";

const workSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["correctness", "preferences"]),
  vote: z.number().int().min(1).max(3),
  criteria: z.array(z.string().min(1)).min(1).max(8),
});

export const judgingSchema = z.strictObject({
  completed: z.array(workSchema.extend({
    checks: z.array(z.strictObject({
      id: z.string().min(1),
      verdict: z.enum(["pass", "fail"]),
      evidence: z.string(),
    })).min(1).max(8),
  })),
  pending: z.array(workSchema),
  attempts: z.array(z.strictObject({
    workId: z.string().min(1),
    attempt: z.number().int().positive(),
    startedAt: z.iso.datetime(),
    elapsedMs: z.number().nonnegative(),
    state: z.enum(["started", "complete", "error"]),
    error: z.string().nullable(),
  })),
});
