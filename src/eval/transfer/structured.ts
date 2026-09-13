import { z } from "zod";

export const checkVerdictSchema = z.enum(["pass", "fail"]);
export const preferenceVerdictSchema = z.enum(["pass", "fail", "not-applicable"]);
export const reasoningEffortSchema = z.enum([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export const dependencyModeSchema = z.literal("current");
export const dependencyStateSchema = z.enum([
  "not-required",
  "not-installed",
  "exact",
]);

export const generatedTaskSchema = z.strictObject({
  prompt: z.string().min(1).max(4_000),
  completion: z.array(z.string().min(1).max(1_000)).min(1).max(5),
  preferenceSources: z.array(z.string().min(1)).min(1),
});

export const generatedTasksSchema = z.strictObject({
  tasks: z.array(generatedTaskSchema).min(1).max(10),
});

export const generatedTasksOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "completion", "preferenceSources"],
        properties: {
          prompt: { type: "string", minLength: 1, maxLength: 4000 },
          completion: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string", minLength: 1, maxLength: 1000 },
          },
          preferenceSources: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const;

export const singleJudgmentCheckSchema = z.strictObject({
  verdict: checkVerdictSchema,
  evidence: z.string().min(1),
});

export const judgeResponseSchema = z.strictObject({
  checks: z.array(singleJudgmentCheckSchema),
});

export const judgeOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["checks"],
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["verdict", "evidence"],
        properties: {
          verdict: { type: "string", enum: ["pass", "fail"] },
          evidence: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON output from engine");
  }
}

export function structuredValue(run: {
  readonly structured: unknown;
  readonly text: string;
}): unknown {
  if (run.structured !== null && run.structured !== undefined) {
    return run.structured;
  }
  return parseJson(run.text);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

export function fingerprint(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
}
