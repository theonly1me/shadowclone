import type { LearningExecution } from "../engine";
import { updateLearningEnvironment } from "../environment/update";
import type { ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";
import { updateLegacySkillLibrary, type SkillUpdateSummary } from "../skillMaintenance/legacyUpdate";

export async function maintainSkills(options: {
  readonly paths: ProjectPaths;
  readonly execution?: LearningExecution;
  readonly syncPersonal?: boolean;
  readonly managedConfigPath?: string | null;
  readonly readRemote?: GitRemoteReader;
}): Promise<SkillUpdateSummary> {
  const environment = await updateLearningEnvironment(options);
  return environment ?? await updateLegacySkillLibrary(options);
}
