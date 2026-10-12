import { learningSnapshot, storeLearningRules } from "@shadowclone/environment";
import type { ProjectPaths } from "@shadowclone/core";
import type { ProfileRule, ProfileRuleReference, ProfileSnapshot, ProfileWriteResult } from "@shadowclone/profile";
import type { LearningProvenance } from "./provenance";

export async function readLearningSnapshot(paths: ProjectPaths): Promise<ProfileSnapshot> {
  return learningSnapshot(paths);
}

export async function persistLearningRules(options: {
  readonly paths: ProjectPaths;
  readonly rules: readonly ProfileRule[];
  readonly retired?: readonly ProfileRuleReference[];
  readonly provenance?: Readonly<Record<string, LearningProvenance>>;
}): Promise<ProfileWriteResult> {
  return storeLearningRules(options);
}
