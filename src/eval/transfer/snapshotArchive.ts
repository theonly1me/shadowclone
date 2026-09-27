import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { command } from "./command";
import { isSafeSnapshotLink } from "./snapshotLinks";

type TreeEntry = {
  readonly mode: string;
  readonly objectId: string;
  readonly filename: string;
};

function parseTreeEntry(entry: string): TreeEntry | null {
  const separator = entry.indexOf("\t");

  if (separator < 0) {
    return null;
  }

  const metadata = entry.slice(0, separator).split(" ");

  if (metadata.length !== 3 || metadata[1] !== "blob") {
    return null;
  }

  const [mode, , objectId] = metadata;

  if (mode === undefined || objectId === undefined) {
    return null;
  }

  return { mode, objectId, filename: entry.slice(separator + 1) };
}

function isSafeFilename(filename: string): boolean {
  return (
    !path.isAbsolute(filename) &&
    filename
      .split("/")
      .every(
        (part) =>
          part !== ".." &&
          part !== "." &&
          part.toLowerCase() !== ".git" &&
          part.length > 0,
      )
  );
}

export async function extractSnapshotArchive(options: {
  readonly repository: string;
  readonly commit: string;
  readonly container: string;
  readonly directory: string;
}): Promise<void> {
  if (!/^[a-f0-9]{40,64}$/i.test(options.commit)) {
    throw new Error("Snapshot requires a full commit object id");
  }

  const tree = await command({
    arguments: ["git", "ls-tree", "-rz", "--full-tree", options.commit],
    cwd: options.repository,
  });
  const links = new Map<string, string>();

  for (const rawEntry of tree.split("\0").filter(Boolean)) {
    const entry = parseTreeEntry(rawEntry);

    if (
      entry === null ||
      !["100644", "100755", "120000"].includes(entry.mode) ||
      !isSafeFilename(entry.filename)
    ) {
      throw new Error(
        "Snapshot contains an unsafe path, symbolic link, or submodule",
      );
    }

    if (entry.mode !== "120000") {
      continue;
    }

    let target = links.get(entry.objectId);

    if (target === undefined) {
      target = await command({
        arguments: ["git", "cat-file", "blob", entry.objectId],
        cwd: options.repository,
      });
      links.set(entry.objectId, target);
    }

    if (
      !isSafeSnapshotLink({
        directory: options.directory,
        relativePath: entry.filename,
        target,
      })
    ) {
      throw new Error(
        "Snapshot contains an unsafe path, symbolic link, or submodule",
      );
    }
  }

  await mkdir(options.directory, { mode: 0o700 });

  const archivePath = path.join(options.container, "source.tar");

  await command({
    arguments: [
      "git",
      "archive",
      "--format=tar",
      `--output=${archivePath}`,
      options.commit,
    ],
    cwd: options.repository,
  });
  await command({
    arguments: ["tar", "-xf", archivePath, "-C", options.directory],
    cwd: options.directory,
  });
  await rm(archivePath);
}
