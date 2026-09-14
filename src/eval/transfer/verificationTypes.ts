import type { CheckVote } from "./types";

export type VerificationResult = {
  readonly requirement: string;
  readonly verdict: "pass" | "fail" | "uncertain";
  readonly evidence: string;
  readonly votes: readonly CheckVote<"pass" | "fail">[];
};
