import { z } from "zod";
import { checkVerdictSchema, preferenceVerdictSchema } from "./structured";

const correctnessCheck = z.strictObject({
  verdict: checkVerdictSchema,
  evidence: z.string().min(1),
});

export const candidateSchema = z.strictObject({
  correctness: z.array(correctnessCheck),
  preferences: z.array(correctnessCheck.extend({
    verdict: preferenceVerdictSchema,
  })),
});

export type CandidateVote = z.infer<typeof candidateSchema>;

function checksSchema(verdicts: readonly string[]) {
  return {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "evidence"],
      properties: {
        verdict: { type: "string", enum: verdicts },
        evidence: { type: "string", minLength: 1 },
      },
    },
  } as const;
}

export const candidateOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["correctness", "preferences"],
  properties: {
    correctness: checksSchema(["pass", "fail"]),
    preferences: checksSchema(["pass", "fail", "not-applicable"]),
  },
} as const;
