import type { EnvironmentArtifact, EnvironmentState } from "../types";

export type MissingBuildSkill = {
  readonly name: string;
  readonly filePaths: readonly string[];
};

function isBuildSkill(artifact: EnvironmentArtifact): boolean {
  return artifact.kind === "skill" && artifact.buildId !== undefined;
}

function isSelected(options: {
  readonly state: EnvironmentState;
  readonly artifact: EnvironmentArtifact;
}): boolean {
  const build = options.state.builds.find(({ id }) => id === options.artifact.buildId);
  const entryId = options.artifact.buildEntryId ?? "";
  const choice = build?.choices[entryId];

  return choice === true || (choice === undefined && entryId === "build-preferences");
}

export async function withoutMissingBuildSkills(state: EnvironmentState): Promise<{
  readonly state: EnvironmentState;
  readonly missing: readonly MissingBuildSkill[];
}> {
  const present = await Promise.all(
    state.artifacts.map(
      async (artifact) => !isBuildSkill(artifact) || (await Bun.file(artifact.filePath).exists()),
    ),
  );
  const artifacts = state.artifacts.filter((_, index) => present[index]);
  const missingCopies = state.artifacts.filter((_, index) => !present[index]);
  const missing = [
    ...Map.groupBy(missingCopies, (artifact) => `${artifact.buildId}/${artifact.name}`).values(),
  ].flatMap((copies) => {
    const [first] = copies;

    if (!first || !isSelected({ state, artifact: first })) {
      return [];
    }

    const remains = artifacts.some(
      (artifact) => isBuildSkill(artifact) && artifact.buildId === first.buildId && artifact.name === first.name,
    );

    return remains ? [] : [{ name: first.name, filePaths: copies.map(({ filePath }) => filePath) }];
  });

  return { state: { ...state, artifacts }, missing };
}
