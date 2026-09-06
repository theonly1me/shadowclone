export type SessionBehavior = {
  readonly tools: readonly string[];
  readonly verificationSteps: readonly string[];
  readonly filesTouched: readonly string[] | null;
  readonly plannedBeforeEditing: boolean;
};

export type ReplayScore = {
  readonly tools: number;
  readonly verification: number | null;
  readonly files: number | null;
  readonly planning: number;
  readonly total: number;
};

export type ScoreDelta = {
  readonly tools: number;
  readonly verification: number | null;
  readonly files: number | null;
  readonly planning: number;
  readonly total: number;
};

export type EvalSessionResult = {
  readonly sessionId: string;
  readonly prompt: string;
  readonly baseline: ReplayScore;
  readonly clone: ReplayScore;
  readonly delta: ScoreDelta;
};

export type EvalReceipt = {
  readonly evalId: string;
  readonly timestamp: string;
  readonly sessionsEvaluated: number;
  readonly averageBaseline: ReplayScore;
  readonly averageClone: ReplayScore;
  readonly averageDelta: ScoreDelta;
  readonly sessions: readonly EvalSessionResult[];
};
