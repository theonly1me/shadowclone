import path from "node:path";
import { readLocalText } from "../../localFiles";
import type { ProjectPaths } from "../../paths";
import {
  readGeneratedProfileState,
  readProfileRejections,
} from "../state";
import {
  renderGeneratedProfileState,
  renderProfileRejections,
} from "../stateRender";
import { discoverOriginRepairs } from "./discover";
import { mergeProfileContent, mergeReferenceContent } from "./merge";
import type {
  BlockedOriginRepair,
  OriginRepair,
  ProfileRepairPlan,
} from "./types";

async function markdownFiles(root: string): Promise<readonly string[]> {
  try {
    return (await Array.fromAsync(new Bun.Glob("**/*.md").scan({
      cwd: root,
      onlyFiles: true,
      throwErrorOnBrokenSymlink: true,
    }))).sort();
  } catch {
    return [];
  }
}

function rewriteRelativePath(options: {
  readonly relativePath: string;
  readonly repairs: readonly {
    readonly sourceDirectory: string;
    readonly targetDirectory: string;
  }[];
}): string {
  for (const repair of options.repairs) {
    const sourcePrefix = `org/${repair.sourceDirectory}/`;
    if (options.relativePath.startsWith(sourcePrefix)) {
      return `org/${repair.targetDirectory}/${options.relativePath.slice(sourcePrefix.length)}`;
    }
  }
  return options.relativePath;
}

async function planOrigin(options: {
  readonly paths: ProjectPaths;
  readonly sourceDirectory: string;
  readonly targetDirectory: string;
  readonly originId: string;
}): Promise<{
  readonly repair?: OriginRepair;
  readonly blocked?: BlockedOriginRepair;
  readonly updates: ProfileRepairPlan["updates"];
}> {
  const locations = [
    { root: "org", reference: false },
    { root: path.join("references", "org"), reference: true },
  ];
  const updates: ProfileRepairPlan["updates"][number][] = [];
  for (const location of locations) {
    const sourceRoot = path.join(
      options.paths.profileDirectory,
      location.root,
      options.sourceDirectory,
    );
    for (const tail of await markdownFiles(sourceRoot)) {
      const sourcePath = path.join(sourceRoot, tail);
      const targetRelativePath = path.join(location.root, options.targetDirectory, tail);
      const targetPath = path.join(options.paths.profileDirectory, targetRelativePath);
      const source = await readLocalText(sourcePath);
      const target = await readLocalText(targetPath);
      if (source === null) continue;
      const merged = location.reference
        ? mergeReferenceContent({
            source,
            target,
            targetDirectory: options.targetDirectory,
          })
        : mergeProfileContent({
            source,
            target,
            targetRelativePath,
            originId: options.originId,
          });
      if ("blocked" in merged) {
        return {
          blocked: {
            sourceDirectory: options.sourceDirectory,
            targetDirectory: options.targetDirectory,
            reason: merged.blocked,
          },
          updates: [],
        };
      }
      updates.push({ filePath: targetPath, previous: target, next: merged.content });
      updates.push({ filePath: sourcePath, previous: source, next: null });
    }
  }
  return {
    repair: {
      sourceDirectory: options.sourceDirectory,
      targetDirectory: options.targetDirectory,
      files: updates.length / 2,
    },
    updates,
  };
}

export async function createProfileRepairPlan(
  paths: ProjectPaths,
): Promise<ProfileRepairPlan> {
  const discovered = await discoverOriginRepairs(paths.profileDirectory);
  const repairs: OriginRepair[] = [];
  const blocked: BlockedOriginRepair[] = [];
  const updates: ProfileRepairPlan["updates"][number][] = [];
  for (const legacy of discovered.legacy) {
    const planned = await planOrigin({ paths, ...legacy });
    if (planned.blocked) blocked.push(planned.blocked);
    if (planned.repair) repairs.push(planned.repair);
    updates.push(...planned.updates);
  }
  const safeRepairs = discovered.legacy.filter((legacy) =>
    !blocked.some((entry) => entry.sourceDirectory === legacy.sourceDirectory)
  );
  const previousManifest = await readLocalText(paths.profileManifestFile);
  if (previousManifest !== null) {
    const entries = await readGeneratedProfileState(paths.profileManifestFile);
    const next = renderGeneratedProfileState(entries.map((entry) => ({
      ...entry,
      relativePath: rewriteRelativePath({
        relativePath: entry.relativePath,
        repairs: safeRepairs,
      }),
    })));
    updates.push({ filePath: paths.profileManifestFile, previous: previousManifest, next });
  }
  const previousRejections = await readLocalText(paths.rejectedProfileFile);
  if (previousRejections !== null) {
    const entries = await readProfileRejections(paths.rejectedProfileFile);
    const next = renderProfileRejections(entries.map((entry) => ({
      ...entry,
      relativePath: rewriteRelativePath({
        relativePath: entry.relativePath,
        repairs: safeRepairs,
      }),
    })));
    updates.push({ filePath: paths.rejectedProfileFile, previous: previousRejections, next });
  }
  return {
    repairs,
    blocked,
    isolatedDirectories: discovered.isolatedDirectories,
    legacyDirectories: discovered.legacy.length,
    updates,
  };
}
