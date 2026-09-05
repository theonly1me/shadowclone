export type SessionBehavior = {
  readonly tools: readonly string[];
  readonly verificationSteps: readonly string[];
  readonly filesTouched: readonly string[];
  readonly plannedBeforeEditing: boolean;
};

export type ReplayScore = {
  readonly tools: number;
  readonly verification: number;
  readonly files: number;
  readonly planning: number;
  readonly total: number;
};
