import { copyFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import { readLocalText, replaceLocalText } from "../../localFiles";
import type { ClaudeMemoryFile, ClaudeMemoryManifest } from "./types";
import { scanClaudeMemoryDirectory } from "./scan";

function hashes(files: readonly ClaudeMemoryFile[]): string {
  return files.map((file) => `${file.filename}:${file.hash}`).sort().join("\n");
}

export async function createVerifiedBackup(options: {
  readonly sourceDirectory: string;
  readonly now: number;
  readonly files: readonly ClaudeMemoryFile[];
}): Promise<string> {
  const timestamp = new Date(options.now).toISOString().replaceAll(/[:.]/g, "-");
  const backup = `${options.sourceDirectory}.shadowclone-backup-${timestamp}`;
  await cp(options.sourceDirectory, backup, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  const copied = await scanClaudeMemoryDirectory(backup);
  if (hashes(copied) !== hashes(options.files)) {
    throw new Error("Claude memory backup hash verification failed");
  }
  return backup;
}

function readableName(filename: string): string {
  const value = filename.slice(0, -3)
    .replace(/^(feedback|reference)_/, "")
    .replaceAll(/[_-]+/g, " ");
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

export async function rewriteProjectBacklinks(options: {
  readonly files: readonly ClaudeMemoryFile[];
  readonly archived: ReadonlySet<string>;
}): Promise<void> {
  const archived = [...options.archived].map((filename) => ({
    stem: filename.slice(0, -3),
    label: readableName(filename),
  }));
  for (const file of options.files.filter((entry) => entry.kind === "project")) {
    const previous = await readLocalText(file.sourcePath);
    if (previous === null) throw new Error("Claude project memory changed during archive");
    const next = archived.reduce((text, entry) =>
      text.replaceAll(`[[${entry.stem}]]`, entry.label), previous);
    await replaceLocalText({ filePath: file.sourcePath, previous, next });
  }
}

export async function rebuildMemoryIndex(options: {
  readonly sourceDirectory: string;
  readonly files: readonly ClaudeMemoryFile[];
  readonly archived: ReadonlySet<string>;
}): Promise<void> {
  const projects = options.files.filter((file) =>
    file.kind === "project" && !options.archived.has(file.filename)
  );
  const lines = projects.map((file) =>
    `- [${readableName(file.filename)}](${file.filename}) - ${file.description || file.name}`
  );
  const filePath = path.join(options.sourceDirectory, "MEMORY.md");
  await replaceLocalText({
    filePath,
    previous: await readLocalText(filePath),
    next: lines.length === 0 ? null : `# Memory Index\n\n${lines.join("\n")}\n`,
  });
}

export async function removeArchivedFiles(options: {
  readonly sourceDirectory: string;
  readonly filenames: ReadonlySet<string>;
}): Promise<void> {
  for (const filename of options.filenames) {
    await rm(path.join(options.sourceDirectory, filename));
  }
}

export async function restoreBackup(options: {
  readonly backupDirectory: string;
  readonly sourceDirectory: string;
  readonly manifest: ClaudeMemoryManifest;
}): Promise<void> {
  for (const file of options.manifest.files) {
    await copyFile(
      path.join(options.backupDirectory, file.filename),
      path.join(options.sourceDirectory, file.filename),
    );
  }
}
