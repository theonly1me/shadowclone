import { z } from "zod";
import { guidanceProtocols } from "../eval/guidance/schema";

export const optionsSchema = z.object({
  protocol: z.enum(guidanceProtocols),
  engine: z.enum(["claude-code", "codex"]).optional(),
  repo: z.string().min(1),
  model: z
    .string()
    .regex(/^(?:claude-sonnet-5(?:[.-][a-z0-9-]+)?|gpt-6-luna)$/),
  reasoningEffort: z.literal("medium"),
  maxBudgetUsd: z.coerce.number().positive().max(50).optional(),
  validationOf: z.uuid().optional(),
  cumulativeBudgetUsd: z.coerce.number().positive().max(10).optional(),
  maintenanceOf: z.uuid().optional(),
  comparisonOf: z.uuid().optional(),
  additionalBudgetUsd: z.coerce.number().positive().max(20).optional(),
  maxCalls: z.coerce.number().int().positive().max(128),
  deadlineSeconds: z.coerce.number().int().positive().max(14400),
  pilot: z.boolean().default(false),
  scenarioFile: z.string().optional(),
  memorySource: z.string().optional(),
  memoryManifest: z.string().optional(),
  suiteId: z.uuid().optional(),
  evalId: z.uuid().optional(),
  recoverPreflightFailure: z.boolean().default(false),
  failedCliVersion: z.string().min(1).optional(),
  yes: z.literal(true),
});
