import {
  compileContextDetails,
  sessionStartProjection,
} from "../../integrations/compile";
import type { ProjectPaths } from "../../paths";
import { compileProfile } from "../../profile";
import type { RepositoryIdentity } from "../../signal";

export type FrozenEvaluationProfile = {
  readonly markdown: string;
  readonly ruleCount: number;
};

type FullProfileOptions = {
  readonly profileDirectory: string;
  readonly repository: RepositoryIdentity;
  readonly delivery?: "full";
};

type StartupProfileOptions = {
  readonly delivery: "startup";
  readonly cwd: string;
  readonly paths: ProjectPaths;
};

export async function loadEvaluationProfile(
  options: FullProfileOptions | StartupProfileOptions,
): Promise<FrozenEvaluationProfile> {
  const compilation =
    options.delivery === "startup"
      ? (
          await compileContextDetails({
            cwd: options.cwd,
            paths: options.paths,
            ...sessionStartProjection,
          })
        )?.compilation
      : await compileProfile({
          input: {
            kind: "directory",
            profileDirectory: options.profileDirectory,
            origin: options.repository.origin,
            targetRepo: options.repository.profileFileName,
          },
        });

  if (!compilation) {
    throw new Error("Evaluation requires an active Shadowclone profile");
  }

  if (compilation.appliedRuleCount === 0) {
    throw new Error("Evaluation requires an active Shadowclone profile");
  }

  return {
    markdown: compilation.markdown,
    ruleCount: compilation.appliedRuleCount,
  };
}
