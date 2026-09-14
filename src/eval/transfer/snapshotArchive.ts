import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { command } from "./command";

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
  for (const entry of tree.split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\t");
    const mode = entry.slice(0, 6);
    const filename = entry.slice(separator + 1);
    if (
      separator < 0 ||
      !["100644", "100755"].includes(mode) ||
      path.isAbsolute(filename) ||
      filename.split("/").some((part) =>
        part === ".." || part === "." || part.toLowerCase() === ".git" || part.length === 0,
      )
    ) {
      throw new Error("Snapshot contains an unsafe path, symbolic link, or submodule");
    }
  }
  await mkdir(options.directory, { mode: 0o700 });
  const archivePath = path.join(options.container, "source.tar");
  await command({
    arguments: ["git", "archive", "--format=tar", `--output=${archivePath}`, options.commit],
    cwd: options.repository,
  });
  await command({
    arguments: ["tar", "-xf", archivePath, "-C", options.directory],
    cwd: options.directory,
  });
  await rm(archivePath);
}
