import {
  readLegacyProfileSnapshot,
  writeLegacyProfile,
  type ProfileSnapshot,
  type ProfileWriteOptions,
  type ProfileWriteResult,
} from "../profile";
import type { ProjectPaths } from "../paths";
import { learningSnapshot, storeLearningRules } from "./records";

export async function writeProfile(
  options: ProfileWriteOptions,
): Promise<ProfileWriteResult> {
  const learning = await storeLearningRules(options);

  if (learning !== null) {
    return learning;
  }

  return writeLegacyProfile(options);
}

export async function readProfileSnapshot(
  paths: ProjectPaths,
): Promise<ProfileSnapshot> {
  const learning = await learningSnapshot(paths);

  if (learning !== null) {
    return learning;
  }

  return readLegacyProfileSnapshot(paths);
}
