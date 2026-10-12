import type { LearningExecution } from "@shadowclone/agents";
import { updateLearningEnvironment } from "./environmentUpdate/update";
import type { ProjectPaths } from "@shadowclone/core";
import type { GitRemoteReader } from "@shadowclone/sessions";
import { missingEnvironmentMessage } from "@shadowclone/environment";
import type { SkillUpdateSummary } from "./skillMaintenance/update";

export async function maintainSkills(options: {
  readonly paths: ProjectPaths;
  readonly execution?: LearningExecution;
  readonly syncPersonal?: boolean;
  readonly managedConfigPath?: string | null;
  readonly readRemote?: GitRemoteReader;
}): Promise<SkillUpdateSummary> {
  const summary = await updateLearningEnvironment(options);

  if (summary === null) {
    throw new Error(missingEnvironmentMessage);
  }

  return summary;
}
