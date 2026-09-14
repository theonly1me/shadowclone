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
