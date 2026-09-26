import path from "node:path";
import { readRevision } from "../../changes";
import { readEffectiveConfig } from "../../config";
import { readLocalText } from "../../localFiles";
import { canonicalPath, type ProjectPaths } from "../../paths";
import {
  createVerifiedBackup,
  rebuildMemoryIndex,
  removeArchivedFiles,
  restoreBackup,
  rewriteProjectBacklinks,
} from "./archiveFiles";
import { parseClaudeMemoryManifest } from "./manifest";
import { scanClaudeMemoryDirectory } from "./scan";

export type ClaudeMemoryArchiveResult = {
  readonly backupDirectory: string;
  readonly archived: number;
  readonly activeProjects: number;
};

export async function archiveClaudeMemory(options: {
  readonly paths: ProjectPaths;
  readonly revisionId: string;
  readonly now?: number;
  readonly configPath?: string;
  readonly managedConfigPath?: string | null;
}): Promise<ClaudeMemoryArchiveResult> {
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath ?? options.paths.configFile,
    managedConfigPath: options.managedConfigPath === undefined
      ? options.paths.managedConfigFile
      : options.managedConfigPath,
  });
  if (!policy.enabled || !config.sources["claude-memory"]) {
    throw new Error("Enable the claude-memory source before archive");
  }
  const revision = await readRevision({ paths: options.paths, id: options.revisionId });
  if (
    revision.status !== "applied" || revision.kind !== "profile" ||
    canonicalPath(revision.root) !== canonicalPath(options.paths.profileDirectory)
  ) throw new Error("Archive requires an applied Claude memory migration revision");
  const manifestChange = revision.changes.find((change) =>
    /^migrations\/claude-memory-[a-f0-9]{16}\.json$/.test(
      change.relativePath.split(path.sep).join("/"),
    )
  );
  if (!manifestChange?.after) {
    throw new Error("Revision does not contain a Claude memory migration manifest");
  }
  const manifestPath = path.join(revision.root, manifestChange.relativePath);
  const currentManifest = await readLocalText(manifestPath);
  if (currentManifest !== manifestChange.after) {
    throw new Error("Claude memory migration manifest changed after apply");
  }
  const manifest = parseClaudeMemoryManifest(currentManifest);
  if (manifest.files.some((file) => file.disposition === "review-required")) {
    throw new Error("Claude memory feedback review is incomplete");
  }
  const files = await scanClaudeMemoryDirectory(manifest.sourceDirectory);
  const currentHashes = new Map(files.map((file) => [file.filename, file.hash]));
  if (
    files.length !== manifest.files.length ||
    manifest.files.some((file) => currentHashes.get(file.filename) !== file.hash)
  ) {
    throw new Error("Claude memory changed after migration");
  }
  const archived = new Set(manifest.files.flatMap((file) =>
    file.kind === "feedback" || file.kind === "reference" ||
      file.disposition === "recall-reference"
      ? [file.filename]
      : []
  ));
  const backupDirectory = await createVerifiedBackup({
    sourceDirectory: manifest.sourceDirectory,
    now: options.now ?? Date.now(),
    files,
  });
  try {
    await rewriteProjectBacklinks({ files, archived });
    await removeArchivedFiles({ sourceDirectory: manifest.sourceDirectory, filenames: archived });
    await rebuildMemoryIndex({
      sourceDirectory: manifest.sourceDirectory,
      files,
      archived,
    });
    const active = await scanClaudeMemoryDirectory(manifest.sourceDirectory);
    if (active.some((file) => archived.has(file.filename))) {
      throw new Error("Claude memory archive left selected files active");
    }
    return {
      backupDirectory,
      archived: archived.size,
      activeProjects: active.filter((file) => file.kind === "project").length,
    };
  } catch (error) {
    await restoreBackup({ backupDirectory, sourceDirectory: manifest.sourceDirectory, manifest });
    throw error;
  }
}
