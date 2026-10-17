import { fingerprint, readLocalText } from "@shadowclone/core";
import type { FileUpdate } from "@shadowclone/changes";
import type { EnvironmentArtifact } from "./types";

type UnreachedSkillOptions = {
  readonly destinations: readonly string[];
  readonly scope: string;
  readonly name: string;
  readonly activeKeys: ReadonlySet<string>;
};

function isUnreachedSkill(options: UnreachedSkillOptions & { readonly artifact: EnvironmentArtifact }): boolean {
  const { artifact } = options;

  return (
    artifact.kind === "skill" &&
    artifact.buildId === undefined &&
    artifact.name === options.name &&
    artifact.scope === options.scope &&
    !options.destinations.includes(artifact.filePath) &&
    artifact.learningKeys.length > 0 &&
    !artifact.learningKeys.some((key) => options.activeKeys.has(key))
  );
}

export async function releaseUnreachedSkills(options: UnreachedSkillOptions & {
  readonly artifacts: readonly EnvironmentArtifact[];
}): Promise<{ readonly artifacts: EnvironmentArtifact[]; readonly updates: readonly FileUpdate[] }> {
  const artifacts: EnvironmentArtifact[] = [];
  const updates: FileUpdate[] = [];

  for (const artifact of options.artifacts) {
    if (!isUnreachedSkill({ ...options, artifact })) {
      artifacts.push(artifact);
      continue;
    }

    const previous = await readLocalText(artifact.filePath);

    if (previous === null) {
      continue;
    }

    if (fingerprint(previous) !== artifact.fingerprint) {
      artifacts.push(artifact);
      continue;
    }

    updates.push({ filePath: artifact.filePath, previous, next: artifact.original });
  }

  return { artifacts, updates };
}
