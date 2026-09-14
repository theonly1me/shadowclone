import { compileProfile } from "../../profile";
import type { RepositoryIdentity } from "../../signal";

export type FrozenEvaluationProfile = {
  readonly markdown: string;
  readonly ruleCount: number;
};

export async function loadEvaluationProfile(options: {
  readonly profileDirectory: string;
  readonly repository: RepositoryIdentity;
}): Promise<FrozenEvaluationProfile> {
  const compilation = await compileProfile({
    input: {
      kind: "directory",
      profileDirectory: options.profileDirectory,
      origin: options.repository.origin,
      targetRepo: options.repository.profileFileName,
    },
  });
  if (compilation.appliedRuleCount === 0) {
    throw new Error("Evaluation requires an active Shadowclone profile");
  }
  return {
    markdown: compilation.markdown,
    ruleCount: compilation.appliedRuleCount,
  };
}
