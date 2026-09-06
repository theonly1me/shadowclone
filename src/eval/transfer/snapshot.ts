import { lstat, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./command";

export interface SnapshotResult {
  readonly directory: string;
  readonly initialCommit: string;
  readonly cleanup: () => Promise<void>;
}

const restrictedSettingsPaths = [
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".mcp.json",
  ".codex",
  ".claude/agents/shadowclone.md",
  ".claude/skills/shadowclone",
] as const;

export async function createSnapshot(options: {
  readonly repository: string;
  readonly commit: string;
}): Promise<SnapshotResult> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-transfer-"),
  );

  try {
    const archivePath = path.join(directory, "source.tar");

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
      arguments: ["tar", "-xf", archivePath, "-C", directory],
      cwd: directory,
    });

    await rm(archivePath);

    const globScanner = new Bun.Glob("**/*").scan({
      cwd: directory,
      dot: true,
      onlyFiles: false,
    });

    for await (const matchPath of globScanner) {
      const entryStats = await lstat(path.join(directory, matchPath));
      if (entryStats.isSymbolicLink()) {
        throw new Error("Task snapshot contains a symbolic link");
      }
    }

    for (const relativePath of restrictedSettingsPaths) {
      await rm(path.join(directory, relativePath), {
        recursive: true,
        force: true,
      });
    }

    await command({
      arguments: ["git", "init", "--quiet"],
      cwd: directory,
    });

    await command({
      arguments: ["git", "add", "--all"],
      cwd: directory,
    });

    await command({
      arguments: [
        "git",
        "-c",
        "user.name=Shadowclone",
        "-c",
        "user.email=eval@localhost",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        "Evaluation starting state",
      ],
      cwd: directory,
    });

    const initialCommit = await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    });

    return {
      directory,
      initialCommit,
      cleanup: async () => {
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
