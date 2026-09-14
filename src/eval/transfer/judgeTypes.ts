import type { CheckVote } from "./types";

export type JudgeWork = {
  readonly id: string;
  readonly kind: "correctness" | "preferences";
  readonly vote: number;
  readonly criteria: readonly string[];
};

export type JudgeBatchVote = JudgeWork & {
  readonly checks: readonly (CheckVote & { readonly id: string })[];
};

export type JudgeAttempt = {
  readonly workId: string;
  readonly attempt: number;
  readonly startedAt: string;
  readonly elapsedMs: number;
  readonly state: "started" | "complete" | "error";
  readonly error: string | null;
};

export type JudgingState = {
  readonly completed: readonly JudgeBatchVote[];
  readonly pending: readonly JudgeWork[];
  readonly attempts: readonly JudgeAttempt[];
};
