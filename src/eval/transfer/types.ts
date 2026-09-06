import type { EngineId, EngineRunner } from "../../engine";
import type { ProjectPaths } from "../../paths";

export type TransferOptions = {
  readonly repo?: string;
  readonly model?: string;
  readonly engine?: EngineId;
  readonly tasks?: number;
  readonly repeat?: number;
  readonly timeoutSeconds?: number;
  readonly evalId?: string;
  readonly since?: string;
  readonly json?: boolean;
  readonly maxBudgetUsd?: number;
  readonly paths?: ProjectPaths;
  readonly runner?: EngineRunner;
};

export type Evidence = {
  readonly id: string;
  readonly sessionId: string;
  readonly timestamp: number;
  readonly text: string;
};

export type PreferenceCheck = {
  readonly requirement: string;
  readonly evidenceId: string;
  readonly quote: string;
};

export type DelegationTask = {
  readonly id: string;
  readonly sourceSession: string;
  readonly startingCommit: string;
  readonly prompt: string;
  readonly completion: readonly string[];
  readonly preferences: readonly PreferenceCheck[];
  readonly training: readonly Evidence[];
  readonly profile: string;
  readonly profileFingerprint: string;
};

export type PreparedEval = {
  readonly context: readonly { readonly relativePath: string; readonly content: string }[];
  readonly schemaVersion: 2;
  readonly evalId: string;
  readonly repository: string;
  readonly engine: EngineId;
  readonly model: string;
  readonly repeat: number;
  readonly timeoutSeconds: number;
  readonly maxBudgetUsd: number | null;
  readonly tasks: readonly DelegationTask[];
  readonly exclusions: readonly { readonly sessionId: string; readonly reason: string }[];
};

export type Verdict = "pass" | "fail" | "uncertain";
export type CheckResult = {
  readonly requirement: string;
  readonly verdict: Verdict;
  readonly evidence: string;
};

export type TransferRun = {
  readonly taskId: string;
  readonly repeat: number;
  readonly arm: "baseline" | "clone";
  readonly sessionId: string | null;
  readonly failure: string | null;
  readonly durationMs: number;
  readonly costUsd: number | null;
  readonly correctness: readonly CheckResult[];
  readonly preferences: readonly CheckResult[];
};

export type TransferReceipt = {
  readonly schemaVersion: 2;
  readonly evalId: string;
  readonly status: "complete" | "insufficient-evidence" | "incomplete";
  readonly preparedFingerprint: string;
  readonly runs: readonly TransferRun[];
  readonly prepared: PreparedEval;
  readonly limitations: readonly string[];
};

export type ModelCall = (options: {
  readonly prompt: string;
  readonly cwd: string;
  readonly execute?: boolean;
  readonly outputSchema?: unknown;
}) => ReturnType<EngineRunner>;
