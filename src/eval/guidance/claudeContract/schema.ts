import { z } from "zod";

export const legacySchemaFailure =
  'Error: --json-schema is not a valid JSON Schema: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"';

export const contractProofSchema = z.strictObject({
  checkedAt: z.number(),
  cliVersion: z.string().min(1),
  executableFingerprint: z.string().min(1),
  legacySchemaFingerprint: z.string().min(1),
  currentSchemaFingerprint: z.string().min(1),
  legacyMessages: z.literal(0),
  currentMessages: z.number().int().positive(),
  legacyFailure: z.literal(legacySchemaFailure),
  network: z.literal("loopback-only"),
});

export type ClaudeContractProof = z.infer<typeof contractProofSchema>;
