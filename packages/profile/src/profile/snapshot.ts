import type { ProfileRejection } from "./state";
import type { ProfileRule } from "./types";

export type ProfileSnapshotRule = {
  readonly rule: ProfileRule;
  readonly promptTitle: string;
  readonly promptBody: string;
  readonly promptAppliesWhen: readonly string[];
  readonly promptProposal: ProfileRule["proposal"];
};

export type ProfileSnapshotRejection = {
  readonly rejection: ProfileRejection;
  readonly promptTitle: string | null;
  readonly promptBody: string | null;
};

export type ProfileSnapshot = {
  readonly rules: readonly ProfileSnapshotRule[];
  readonly rejections: readonly ProfileSnapshotRejection[];
};
