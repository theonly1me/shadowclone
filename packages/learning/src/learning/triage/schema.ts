import { z } from "zod";

const discardReasons = ["duplicate", "skill-covered", "stale", "one-off"] as const;

export type TriageDiscardReason = (typeof discardReasons)[number];

const decisionSchema = z.strictObject({
  token: z.string().max(64),
  verdict: z.enum(["apply", "discard", "defer"]),
  reason: z.enum(["", ...discardReasons]),
  note: z.string().max(200),
});

const triageSchema = z.strictObject({
  decisions: z.array(decisionSchema).max(64),
});

export type TriageDecision = z.infer<typeof decisionSchema>;

export const triageOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      maxItems: 64,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["token", "verdict", "reason", "note"],
        properties: {
          token: { type: "string", maxLength: 64 },
          verdict: { type: "string", enum: ["apply", "discard", "defer"] },
          reason: { type: "string", enum: ["", ...discardReasons] },
          note: { type: "string", maxLength: 200 },
        },
      },
    },
  },
} as const;

export function parseTriageOutput(value: unknown): readonly TriageDecision[] {
  const parsed = triageSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("The engine returned an invalid triage result");
  }

  return parsed.data.decisions;
}
