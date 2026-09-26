import { z } from "zod";

export const comparisonSchema = z.strictObject({
  version: z.literal(1), parentEvalId: z.uuid(), parentReceiptFingerprint: z.string(), parentBudgetFingerprint: z.string(),
  priorSpentUsd: z.number().nonnegative(), priorCalls: z.number().int().nonnegative(),
  additionalLimitUsd: z.number().positive().max(20), windowSeconds: z.number().int().positive().max(5400),
  resolvedModel: z.literal("claude-sonnet-5"),
});
