import path from "node:path";
import type { FileUpdate } from "../changes";
import { publishSkillResources } from "../environment/resources";
import type { EnvironmentArtifact, EnvironmentState } from "../environment/types";
import { fingerprint, readLocalFile, readLocalText } from "../localFiles";
import { parseSkillDocument } from "../skillMaintenance/document";
import { loadSeedLibrary, seedSkillsDirectory } from "../skills/library";

export type BuildSkillSyncReport = {
  readonly updated: readonly { readonly name: string; readonly copies: number }[];
  readonly kept: readonly { readonly name: string; readonly filePath: string }[];
};

type BuildSkillSync = BuildSkillSyncReport & {
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
};

async function editedCopies(
  artifacts: readonly EnvironmentArtifact[],
): Promise<readonly EnvironmentArtifact[]> {
  const edited: EnvironmentArtifact[] = [];

  for (const artifact of artifacts) {
    const text = await readLocalFile({
      filePath: artifact.filePath,
      encoding: artifact.kind === "resource" ? "base64" : "utf8",
    });

    if (text !== null && fingerprint(text) !== artifact.fingerprint) {
      edited.push(artifact);
    }
  }

  return edited;
}

export async function syncBuildSkills(options: {
  readonly state: EnvironmentState;
  readonly packagedSkillsDirectory?: string;
}): Promise<BuildSkillSync> {
  const packagedDirectory = options.packagedSkillsDirectory ?? (await seedSkillsDirectory());
  const packagedIds = new Set((await loadSeedLibrary()).skills.map((skill) => skill.id));
  const updates: FileUpdate[] = [];
  const updated: { name: string; copies: number }[] = [];
  const kept: { name: string; filePath: string }[] = [];
  let artifacts = [...options.state.artifacts];

  for (const build of options.state.builds) {
    const groups = Map.groupBy(
      options.state.artifacts.filter(
        (artifact) =>
          artifact.buildId === build.id &&
          artifact.kind === "skill" &&
          packagedIds.has(artifact.buildEntryId ?? "") &&
          build.edits[artifact.buildEntryId ?? ""] === undefined,
      ),
      (artifact) => artifact.buildEntryId ?? "",
    );

    for (const [entryId, copies] of groups) {
      const resourceCopies = options.state.artifacts.filter(
        (artifact) =>
          artifact.buildId === build.id &&
          artifact.kind === "resource" &&
          artifact.buildEntryId === entryId,
      );
      const edited = await editedCopies([...copies, ...resourceCopies]);

      if (edited.length > 0) {
        kept.push(
          ...edited.map((artifact) => ({ name: artifact.name, filePath: artifact.filePath })),
        );

        continue;
      }

      const packagedText = await Bun.file(path.join(packagedDirectory, entryId, "SKILL.md")).text();
      const outdated = copies.filter(
        (artifact) => artifact.fingerprint !== fingerprint(packagedText),
      );

      if (outdated.length === 0) {
        continue;
      }

      const description = parseSkillDocument(packagedText).metadata.description;
      const resources = await publishSkillResources({
        source: path.join(packagedDirectory, entryId),
        destinations: copies.map((artifact) => artifact.filePath),
        state: { ...options.state, artifacts },
        scope: build.id,
        name: entryId,
      });

      for (const artifact of outdated) {
        updates.push({
          filePath: artifact.filePath,
          previous: await readLocalText(artifact.filePath),
          next: packagedText,
        });
      }

      updates.push(...resources.updates);
      artifacts = artifacts.map((artifact) =>
        outdated.includes(artifact)
          ? { ...artifact, fingerprint: fingerprint(packagedText), description }
          : artifact,
      );

      for (const resource of resources.artifacts) {
        const tracked = { ...resource, buildId: build.id, buildEntryId: entryId };
        const index = artifacts.findIndex((artifact) => artifact.filePath === resource.filePath);

        artifacts = index < 0 ? [...artifacts, tracked] : artifacts.with(index, tracked);
      }

      updated.push({ name: entryId, copies: outdated.length });
    }
  }

  return { state: { ...options.state, artifacts }, updates, updated, kept };
}

export function renderBuildSkillSync(report: BuildSkillSyncReport): readonly string[] {
  return [
    ...report.updated.map(
      (entry) =>
        `Updated ${entry.name} to the bundled version (${entry.copies} cop${entry.copies === 1 ? "y" : "ies"}).`,
    ),
    ...report.kept.map(
      (entry) =>
        `Kept your edited copy of ${entry.name} at ${entry.filePath}. Review it in shadowclone wizard.`,
    ),
  ];
}
