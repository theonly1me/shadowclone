import { z } from "zod";

export const batchSchema = z.strictObject({
  checks: z.array(z.strictObject({
    id: z.string().min(1),
    verdict: z.enum(["pass", "fail"]),
    evidence: z.string().min(1).max(800),
  })).min(1).max(8),
});

export function batchOutputSchema(identifiers: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["checks"],
    properties: {
      checks: {
        type: "array",
        minItems: identifiers.length,
        maxItems: identifiers.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "verdict", "evidence"],
          properties: {
            id: { type: "string", enum: identifiers },
            verdict: { type: "string", enum: ["pass", "fail"] },
            evidence: { type: "string", minLength: 1, maxLength: 800 },
          },
        },
      },
    },
  } as const;
}
