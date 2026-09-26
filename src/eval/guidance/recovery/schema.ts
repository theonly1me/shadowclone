import { z } from "zod";
import { budgetSchema } from "../../transfer/accounting";
import { contractProofSchema } from "../claudeContract";
import { receiptSchema } from "../schema";

export const recoverySchema = z.strictObject({
  version: z.literal(1),
  reason: z.literal("verified-local-schema-rejection"),
  recoveredCostUsd: z.literal(0),
  originalReceipt: receiptSchema,
  originalBudget: budgetSchema,
  originalReceiptFingerprint: z.string(),
  originalBudgetFingerprint: z.string(),
  failedCliVersion: z.string(),
  proof: contractProofSchema,
  deadlineAt: z.number(),
});

export type SchemaRecovery = z.infer<typeof recoverySchema>;
