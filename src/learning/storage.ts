import { learningSnapshot, storeLearningRules } from "../environment";
import type { ProjectPaths } from "../paths";
import { readLegacyProfileSnapshot, type ProfileSnapshot } from "../profile/snapshot";
import { writeLegacyProfile } from "../profile/write";
import type { ProfileRule, ProfileRuleReference, ProfileWriteResult } from "../profile";
import type { LearningProvenance } from "./provenance";

export async function readLearningSnapshot(paths: ProjectPaths): Promise<ProfileSnapshot> {
  return await learningSnapshot(paths) ?? await readLegacyProfileSnapshot(paths);
}

export async function persistLearningRules(options: {
  readonly paths: ProjectPaths;
  readonly rules: readonly ProfileRule[];
  readonly retired?: readonly ProfileRuleReference[];
  readonly provenance?: Readonly<Record<string, LearningProvenance>>;
}): Promise<ProfileWriteResult> {
  return await storeLearningRules(options) ?? await writeLegacyProfile(options);
}
