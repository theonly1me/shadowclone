import { z } from "zod";

export const validationSchema = z.strictObject({
  parentEvalId: z.uuid(), parentReceiptFingerprint: z.string(), parentBudgetFingerprint: z.string(),
  priorSpentUsd: z.number().nonnegative(), priorCalls: z.number().int().nonnegative(),
  cumulativeLimitUsd: z.number().positive().max(10),
  resolvedModel: z.string(),
});
