import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./command";

export async function fixture(): Promise<{
  readonly directory: string;
  readonly commit: string;
}> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-paired-eval-"),
  );

  await Bun.write(
    path.join(directory, "package.json"),
    JSON.stringify({ scripts: { test: "exit 23" } }),
  );
  await command({ arguments: ["git", "init", "--quiet"], cwd: directory });
  await command({ arguments: ["git", "add", "--all"], cwd: directory });
  await command({
    arguments: [
      "git",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@localhost",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    cwd: directory,
  });

  return {
    directory,
    commit: await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    }),
  };
}
