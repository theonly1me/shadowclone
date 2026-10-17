import { fingerprint, readLocalText } from "@shadowclone/core";
import type { FileUpdate } from "@shadowclone/changes";
import type { EnvironmentArtifact, EnvironmentState } from "./types";

type UnreachedSkillOptions = {
  readonly destinations: readonly string[];
  readonly scope: string;
  readonly name: string;
  readonly activeKeys: ReadonlySet<string>;
};

type ReleasedSkills = { readonly artifacts: EnvironmentArtifact[]; readonly updates: readonly FileUpdate[] };

function isLearnedSkill(artifact: EnvironmentArtifact): boolean {
  return artifact.kind === "skill" && artifact.buildId === undefined && artifact.learningKeys.length > 0;
}

function isUnreachedSkill(options: UnreachedSkillOptions & { readonly artifact: EnvironmentArtifact }): boolean {
  const { artifact } = options;

  return (
    isLearnedSkill(artifact) &&
    artifact.name === options.name &&
    artifact.scope === options.scope &&
    !options.destinations.includes(artifact.filePath) &&
    !artifact.learningKeys.some((key) => options.activeKeys.has(key))
  );
}

async function releaseSkills(options: {
  readonly artifacts: readonly EnvironmentArtifact[];
  readonly isReleased: (artifact: EnvironmentArtifact) => boolean;
}): Promise<ReleasedSkills> {
  const artifacts: EnvironmentArtifact[] = [];
  const updates: FileUpdate[] = [];

  for (const artifact of options.artifacts) {
    if (!options.isReleased(artifact)) {
      artifacts.push(artifact);
      continue;
    }

    const previous = await readLocalText(artifact.filePath);

    if (artifact.original === null && previous !== null && fingerprint(previous) === artifact.fingerprint) {
      updates.push({ filePath: artifact.filePath, previous, next: null });
    }
  }

  return { artifacts, updates };
}

export async function releaseUnreachedSkills(options: UnreachedSkillOptions & {
  readonly artifacts: readonly EnvironmentArtifact[];
}): Promise<ReleasedSkills> {
  return releaseSkills({
    artifacts: options.artifacts,
    isReleased: (artifact) => isUnreachedSkill({ ...options, artifact }),
  });
}

export async function releaseRetiredSkills(state: EnvironmentState): Promise<{
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
}> {
  const retired = new Set(state.records.filter((record) => record.retirementRequested).map(({ rule }) => rule.key));
  const released = await releaseSkills({
    artifacts: state.artifacts,
    isReleased: (artifact) => isLearnedSkill(artifact) && artifact.learningKeys.every((key) => retired.has(key)),
  });

  return { state: { ...state, artifacts: released.artifacts }, updates: released.updates };
}
