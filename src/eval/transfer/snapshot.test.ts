import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./command";
import {
  createSnapshot,
  disposeSnapshotTemplates,
  validateSnapshotLinks,
} from "./snapshot";

async function withSnapshot(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-snapshot-links-"),
  );
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("allows relative symbolic links that resolve inside the snapshot", async () => {
  await withSnapshot(async (directory) => {
    await mkdir(path.join(directory, "packages/tool"), { recursive: true });
    await Bun.write(path.join(directory, "packages/tool/index.ts"), "export {};");
    await symlink(
      "packages/tool",
      path.join(directory, "linked-tool"),
    );

    await expect(validateSnapshotLinks(directory)).resolves.toBeUndefined();
  });
});

test("rejects absolute symbolic links", async () => {
  await withSnapshot(async (directory) => {
    const target = path.join(directory, "target.txt");
    await Bun.write(target, "target");
    await symlink(target, path.join(directory, "absolute"));

    await expect(validateSnapshotLinks(directory)).rejects.toThrow(
      "unsafe symbolic link",
    );
  });
});

test("rejects symbolic links that escape the snapshot", async () => {
  await withSnapshot(async (directory) => {
    const outside = path.join(path.dirname(directory), "outside.txt");
    await Bun.write(outside, "outside");
    try {
      await symlink("../outside.txt", path.join(directory, "escape"));
      await expect(validateSnapshotLinks(directory)).rejects.toThrow(
        "unsafe symbolic link",
      );
    } finally {
      await rm(outside, { force: true });
    }
  });
});

test("rejects missing symbolic link targets", async () => {
  await withSnapshot(async (directory) => {
    await symlink("missing.txt", path.join(directory, "missing"));
    await expect(validateSnapshotLinks(directory)).rejects.toThrow(
      "unsafe symbolic link",
    );
  });
});

test("clones one committed template into isolated working git repositories", async () => {
  const repository = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-snapshot-repository-"),
  );
  let firstSnapshot: Awaited<ReturnType<typeof createSnapshot>> | undefined;
  let secondSnapshot: Awaited<ReturnType<typeof createSnapshot>> | undefined;
  try {
    await Bun.write(path.join(repository, "tracked.txt"), "original");
    await command({ arguments: ["git", "init", "--quiet"], cwd: repository });
    await command({ arguments: ["git", "add", "--all"], cwd: repository });
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
      cwd: repository,
    });
    const commit = await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: repository,
    });
    [firstSnapshot, secondSnapshot] = await Promise.all([
      createSnapshot({ repository, commit }),
      createSnapshot({ repository, commit }),
    ]);
    expect(firstSnapshot.directory).not.toBe(secondSnapshot.directory);
    expect(firstSnapshot.initialCommit).toBe(secondSnapshot.initialCommit);
    for (const snapshot of [firstSnapshot, secondSnapshot]) {
      expect(await Bun.file(path.join(snapshot.directory, "tracked.txt")).text())
        .toBe("original");
      expect(await command({
        arguments: ["git", "rev-parse", "HEAD"],
        cwd: snapshot.directory,
      })).toBe(snapshot.initialCommit);
    }
    await Bun.write(path.join(firstSnapshot.directory, "only-first.txt"), "first");
    expect(await Bun.file(path.join(
      secondSnapshot.directory,
      "only-first.txt",
    )).exists()).toBeFalse();
    await firstSnapshot.cleanup();
    firstSnapshot = undefined;
    expect(await Bun.file(path.join(
      secondSnapshot.directory,
      "tracked.txt",
    )).text()).toBe("original");
  } finally {
    await firstSnapshot?.cleanup();
    await secondSnapshot?.cleanup();
    await disposeSnapshotTemplates();
    await rm(repository, { recursive: true, force: true });
  }
});
