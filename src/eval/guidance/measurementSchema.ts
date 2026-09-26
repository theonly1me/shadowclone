import { z } from "zod";

export const actionSchema = z.strictObject({
  tool: z.string(),
  path: z.string().nullable(),
  succeeded: z.boolean().nullable(),
  requestSequence: z.number().int().nonnegative().nullable(),
  resultSequence: z.number().int().nonnegative().nullable(),
  effect: z.enum(["read-only", "mutation", "unknown"]),
});

export type MeasuredAction = z.infer<typeof actionSchema>;
