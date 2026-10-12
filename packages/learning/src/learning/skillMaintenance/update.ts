export type SkillUpdateSummary = {
  readonly assessed: number;
  readonly applied: number;
  readonly pending: number;
  readonly invalid: number;
  readonly duplicates: number;
  readonly deferred: number;
  readonly verification: number;
  readonly synced: number;
  readonly conflicts: number;
  readonly held?: number;
  readonly libraryReviewed?: number;
  readonly libraryDeferred?: number;
};
