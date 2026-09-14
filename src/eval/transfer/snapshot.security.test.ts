import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runHostCommand } from "../../io/hostCommand";
import { prepareDependencies } from "./dependencies";
import { createSnapshot } from "./snapshot";

test("snapshot extraction rejects tracked links before writing and permits archive-like filenames", async () => {
  const repository = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-snapshot-security-"),
  );
  const git = (arguments_: readonly string[]) =>
    runHostCommand({ arguments: ["git", ...arguments_], cwd: repository });
  try {
    await git(["init", "--quiet"]);
    await writeFile(
      path.join(repository, "source.tar"),
      "ordinary tracked content",
    );
    await git(["add", "--all"]);
    await git([
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "commit",
      "-qm",
      "fixture",
    ]);
    const commit = (await git(["rev-parse", "HEAD"])).stdout.trim();
    const snapshot = await createSnapshot({ repository, commit });
    try {
      expect(
        await Bun.file(path.join(snapshot.directory, "source.tar")).text(),
      ).toBe("ordinary tracked content");
    } finally {
      await snapshot.cleanup();
    }
    await symlink("/tmp", path.join(repository, "escape"));
    await git(["add", "--all"]);
    await git([
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "commit",
      "-qm",
      "linked fixture",
    ]);
    const unsafeCommit = (await git(["rev-parse", "HEAD"])).stdout.trim();
    await expect(
      createSnapshot({ repository, commit: unsafeCommit }),
    ).rejects.toThrow("unsafe path");
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("dependency link chains must resolve inside the repository", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-dependency-security-"),
  );
  try {
    const repository = path.join(root, "repository");
    const directory = path.join(root, "snapshot");
    const outside = path.join(root, "outside");
    await mkdir(path.join(repository, "node_modules"), { recursive: true });
    await mkdir(directory);
    await mkdir(outside);
    await writeFile(path.join(directory, "package.json"), "{}");
    for (const target of [repository, directory]) {
      await writeFile(path.join(target, "bun.lock"), "identical-lock");
    }
    await symlink(outside, path.join(repository, "bridge"));
    await symlink(
      "../bridge",
      path.join(repository, "node_modules", "package"),
    );
    await expect(
      prepareDependencies({ repository, directory }),
    ).rejects.toThrow("outside the repository");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
