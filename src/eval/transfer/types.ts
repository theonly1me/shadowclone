import type {
  EngineId,
  EngineRunner,
  ReasoningEffort,
} from "../../engine";
import type { ProjectPaths } from "../../paths";
import type { EvaluationArm } from "./arms";
import type { JudgingState } from "./judgeTypes";

export const dependencyModes = ["current"] as const;
export type DependencyMode = (typeof dependencyModes)[number];

export type DependencyState =
  | "not-required"
  | "not-installed"
  | "exact";

export type TransferOptions = {
  readonly repo?: string;
  readonly task?: string;
  readonly suiteId?: string;
  readonly model?: string;
  readonly engine?: EngineId;
  readonly reasoningEffort?: ReasoningEffort;
  readonly dependencyMode?: DependencyMode;
  readonly tasks?: number;
  readonly repeat?: number;
  readonly timeoutSeconds?: number;
  readonly deadlineSeconds?: number;
  readonly evalId?: string;
  readonly json?: boolean;
  readonly yes?: boolean;
  readonly maxBudgetUsd?: number;
  readonly paths?: ProjectPaths;
  readonly runner?: EngineRunner;
};

export type PreferenceCheck = {
  readonly requirement: string;
  readonly rubric?: {
    readonly version: 1 | 2;
    readonly id: string;
    readonly fingerprint: string;
    readonly interpretation?: string;
    readonly scope: "changed-code-and-tests";
    readonly override: string;
  };
  readonly source: {
    readonly relativePath: string;
    readonly heading: string;
    readonly line: number;
  };
};

export type DelegationTask = {
  readonly id: string;
  readonly startingCommit: string;
  readonly prompt: string;
  readonly completion: readonly string[];
  readonly preferences: readonly PreferenceCheck[];
  readonly profile: string;
  readonly profileFingerprint: string;
};

export type EvaluationProfileSnapshot = {
  readonly kind: "current";
  readonly fingerprint: string;
  readonly ruleCount: number;
};

export type EvaluationProgress = {
  readonly stage:
    | "ready"
    | "snapshot"
    | "coding"
    | "collecting"
    | "safety"
    | "judging"
    | "timeout"
    | "complete"
    | "error";
  readonly taskIndex: number | null;
  readonly taskCount: number;
  readonly repeatIndex: number | null;
  readonly repeatCount: number;
  readonly arm: EvaluationArm | null;
  readonly voteIndex: number | null;
  readonly voteCount: number | null;
  readonly updatedAt: string;
};

export type PreferenceVerdict = "pass" | "fail" | "not-applicable";

export type CheckVote<Verdict extends PreferenceVerdict = "pass" | "fail"> = {
  readonly verdict: Verdict;
  readonly evidence: string;
};

export type CheckResult<Verdict extends PreferenceVerdict = "pass" | "fail"> = {
  readonly requirement: string;
  readonly verdict: Verdict;
  readonly evidence: string;
  readonly votes: readonly CheckVote<Verdict>[];
};

export type ContextFile = {
  readonly relativePath: string;
  readonly content: string;
};

export type EvaluationSuite = {
  readonly schemaVersion: 3;
  readonly suiteId: string;
  readonly repository: string;
  readonly baseCommit: string;
  readonly context: readonly ContextFile[];
  readonly profileSnapshot: EvaluationProfileSnapshot;
  readonly tasks: readonly DelegationTask[];
};

export type PreparedEval = Omit<EvaluationSuite, "schemaVersion"> & {
  readonly schemaVersion: 12;
  readonly evalId: string;
  readonly engine: EngineId;
  readonly model: string;
  readonly reasoningEffort: ReasoningEffort | null;
  readonly dependencyMode: DependencyMode;
  readonly repeat: number;
  readonly timeoutSeconds: number;
  readonly maxBudgetUsd: number | null;
  readonly dirtyFileCount: number;
  readonly preflight: readonly CheckResult[];
};

export type TransferRun = {
  readonly taskId: string;
  readonly repeat: number;
  readonly arm: EvaluationArm;
  readonly phase: "evidence" | "complete";
  readonly sessionId: string | null;
  readonly failure: string | null;
  readonly failureStage?: "execution" | "judging" | null;
  readonly judging?: JudgingState;
  readonly durationMs: number;
  readonly costUsd: number | null;
  readonly dependencyState: DependencyState | null;
  readonly observed: string | null;
  readonly verification: readonly CheckResult[];
  readonly safety: readonly CheckResult[];
  readonly correctness: readonly CheckResult[];
  readonly preferences: readonly CheckResult<PreferenceVerdict>[];
};

export type TransferReceipt = {
  readonly schemaVersion: 12;
  readonly evalId: string;
  readonly status: "running" | "complete" | "pass" | "fail" | "error";
  readonly preparedFingerprint: string;
  readonly runs: readonly TransferRun[];
  readonly progress: EvaluationProgress | null;
  readonly prepared: PreparedEval;
  readonly limitations: readonly string[];
};

export type ModelCall = (options: {
  readonly prompt: string;
  readonly cwd: string;
  readonly access?: "none" | "read" | "write";
  readonly blockedPaths?: readonly string[];
  readonly outputSchema?: unknown;
}) => ReturnType<EngineRunner>;
