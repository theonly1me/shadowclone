import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRun } from "../../engine";
import { command } from "./command";
import { observeRun } from "./observeRun";

const completedRun: EngineRun = {
  engine: "codex",
  sessionId: "run-session",
  transcriptPath: null,
  text: "Done",
  structured: null,
  costUsd: null,
  durationMs: 1,
  turns: 1,
  actions: [],
  permissionDenials: [],
  isError: false,
  errorMessage: null,
};

test("records an unchanged repository without an empty changed path", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-observe-test-"),
  );

  try {
    await command({ arguments: ["git", "init"], cwd: directory });
    await Bun.write(path.join(directory, "file.txt"), "initial\n");
    await command({ arguments: ["git", "add", "file.txt"], cwd: directory });
    await command({
      arguments: [
        "git",
        "-c",
        "user.name=Shadowclone",
        "-c",
        "user.email=shadowclone@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-m",
        "initial",
      ],
      cwd: directory,
    });
    const initialCommit = await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    });

    const observed = await observeRun({
      directory,
      run: completedRun,
      initialCommit,
    });

    expect(observed.repositoryChanged).toBeFalse();
    expect(observed.evidence).toContain('"changedPaths":[]');
    expect(observed.evidence).toContain('"repositoryChanged":false');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("records the patch that distinguishes edits from new implementations", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-observe-test-"),
  );

  try {
    await command({ arguments: ["git", "init"], cwd: directory });
    await Bun.write(path.join(directory, "helper.ts"), "export const helper = 1;\n");
    await command({ arguments: ["git", "add", "helper.ts"], cwd: directory });
    await command({
      arguments: [
        "git",
        "-c",
        "user.name=Shadowclone",
        "-c",
        "user.email=shadowclone@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-m",
        "initial",
      ],
      cwd: directory,
    });
    const initialCommit = await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    });
    await Bun.write(path.join(directory, "helper.ts"), "export const helper = 2;\n");

    const observed = await observeRun({
      directory,
      run: completedRun,
      initialCommit,
    });

    expect(observed.repositoryChanged).toBeTrue();
    expect(observed.evidence).toContain('"diff":"diff --git');
    expect(observed.evidence).toContain(
      "-export const helper = 1;\\n+export const helper = 2;",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function engineRun() {
  return {
    engine: "codex" as const,
    sessionId: "observe",
    transcriptPath: null,
    text: "",
    structured: null,
    costUsd: null,
    durationMs: 1,
    turns: 1,
    actions: [],
    permissionDenials: [],
    isError: false,
    errorMessage: null,
  };
}

test("evidence carries changed code verbatim for the judging model", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "observe-secret-"));
  try {
    await Bun.write(path.join(directory, "seed.ts"), "export const seed = 1;\n");
    await command({ arguments: ["git", "init", "--quiet"], cwd: directory });
    await command({ arguments: ["git", "add", "--all"], cwd: directory });
    await command({
      arguments: [
        "git", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost",
        "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "base",
      ],
      cwd: directory,
    });
    const initialCommit = await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    });
    await Bun.write(
      path.join(directory, "cache.ts"),
      [
        'const apiKey = "sk-live-abc123def456ghi789jkl";',
        "export type Cache<Key> = { delete: (key: Key) => boolean };",
        'const record = { key: { id: 1 }, token: "shortish" };',
      ].join("\n"),
    );

    const observed = await observeRun({
      directory,
      initialCommit,
      run: engineRun(),
    });

    const parsed = JSON.parse(observed.evidence);
    const cacheFile = parsed.files.find((file: { path: string }) =>
      file.path.endsWith("cache.ts")
    );
    expect(cacheFile.content).toContain("delete: (key: Key) => boolean");
    expect(cacheFile.content).toContain('const record = { key: { id: 1 }');
    expect(cacheFile.content).not.toContain("[redacted:");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
