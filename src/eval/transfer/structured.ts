import { z } from "zod";

export const preferenceCheckSchema = z.object({
  requirement: z.string().min(1),
  evidenceId: z.string().min(1),
  quote: z.string().min(10),
});

export const preparedTaskResponseSchema = z.object({
  eligible: z.boolean(),
  reason: z.string().optional(),
  startingCommit: z.string().optional(),
  completion: z.array(z.string().min(1)).optional(),
  preferences: z.array(preferenceCheckSchema).optional(),
});

export const checkVerdictSchema = z.enum(["pass", "fail", "uncertain"]);

export const singleJudgmentCheckSchema = z.object({
  verdict: checkVerdictSchema,
  evidence: z.string().min(1),
});

export const judgeResponseSchema = z.object({
  checks: z.array(singleJudgmentCheckSchema),
});

export const contextFileSchema = z.object({
  relativePath: z.string().min(1),
  content: z.string(),
});

export const evidenceSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number(),
  text: z.string(),
});

export const taskSchema = z.object({
  id: z.string().min(1),
  sourceSession: z.string().min(1),
  startingCommit: z.string().min(1),
  prompt: z.string().min(1),
  completion: z.array(z.string().min(1)),
  preferences: z.array(preferenceCheckSchema),
  training: z.array(evidenceSchema),
  profile: z.string(),
  profileFingerprint: z.string().min(1),
});

export const exclusionSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().min(1),
});

export const checkResultSchema = z.object({
  requirement: z.string().min(1),
  verdict: checkVerdictSchema,
  evidence: z.string(),
});

export const transferRunSchema = z.object({
  taskId: z.string().min(1),
  repeat: z.number().int().nonnegative(),
  arm: z.enum(["baseline", "clone"]),
  sessionId: z.string().nullable(),
  failure: z.string().nullable(),
  durationMs: z.number().nonnegative(),
  costUsd: z.number().nullable(),
  correctness: z.array(checkResultSchema),
  preferences: z.array(checkResultSchema),
});

export const preparedEvalSchema = z.object({
  schemaVersion: z.literal(2),
  evalId: z.string().min(1),
  repository: z.string().min(1),
  engine: z.enum(["codex", "claude-code"]),
  model: z.string().min(1),
  repeat: z.number().int().positive(),
  timeoutSeconds: z.number().positive(),
  maxBudgetUsd: z.number().nullable(),
  context: z.array(contextFileSchema),
  tasks: z.array(taskSchema),
  exclusions: z.array(exclusionSchema),
});

export const receiptSchema = z.object({
  schemaVersion: z.literal(2),
  evalId: z.string().min(1),
  status: z.enum(["complete", "insufficient-evidence", "incomplete"]),
  preparedFingerprint: z.string().min(1),
  runs: z.array(transferRunSchema),
  prepared: preparedEvalSchema,
  limitations: z.array(z.string()),
});

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON output from engine");
  }
}

export function matchedPreferenceChecks(options: {
  readonly checks: readonly {
    readonly requirement: string;
    readonly evidenceId: string;
    readonly quote: string;
  }[];
  readonly evidence: readonly {
    readonly id: string;
    readonly text: string;
  }[];
}):
  | readonly {
      readonly requirement: string;
      readonly evidenceId: string;
      readonly quote: string;
    }[]
  | null {
  const matched = options.checks.flatMap((entry) => {
    const source = options.evidence.find(
      (candidate) => candidate.id === entry.evidenceId,
    );

    if (
      !source ||
      entry.quote.length < 10 ||
      !source.text.includes(entry.quote)
    ) {
      return [];
    }

    return [
      {
        requirement: entry.requirement,
        evidenceId: entry.evidenceId,
        quote: entry.quote,
      },
    ];
  });

  return matched.length === options.checks.length ? matched : null;
}

export function fingerprint(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
