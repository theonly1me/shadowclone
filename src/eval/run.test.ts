import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import type { EngineRun, EngineRunner } from "../engine";
import { openEventIndex } from "../index";
import type { FileTextRef } from "../observe";
import { createProjectPaths } from "../paths";
import { runEval } from "./run";

async function setupTestEnvironment(homeDirectory: string) {
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await mkdir(paths.profileDirectory, { recursive: true });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });

  const index = await openEventIndex(paths.indexDatabase);
  const secretText = "reproduce this bug";
  const sourcePath = path.join(homeDirectory, "prompt.txt");
  const ref: FileTextRef = {
    type: "file",
    sourcePath,
    byteOffset: 0,
    byteLength: secretText.length,
  };
  await Bun.write(sourcePath, secretText);

  index.saveBatch({
    source: "claude-code",
    sourcePath,
    events: [
      {
        source: "claude-code",
        sessionId: "session-1",
        eventId: "e1",
        parentEventId: null,
        timestamp: Date.now(),
        cwd: "/repo",
        gitBranch: "main",
        kind: "user-prompt",
        tool: null,
        isError: false,
        textRef: ref,
      },
      {
        source: "claude-code",
        sessionId: "session-1",
        eventId: "e2",
        parentEventId: "e1",
        timestamp: Date.now() + 100,
        cwd: "/repo",
        gitBranch: "main",
        kind: "tool-call",
        tool: { name: "Edit", toolUseId: "t1" },
        isError: false,
        textRef: null,
      },
    ],
    cursor: {
      sourcePath,
      byteOffset: secretText.length,
      byteSize: secretText.length,
      modifiedAt: Date.now(),
    },
    rescanned: false,
    bytesRead: secretText.length,
  });
  index.close();
  return paths;
}

test("runEval executes baseline and clone runs and writes an eval receipt", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-eval-test-"),
  );
  const paths = await setupTestEnvironment(homeDirectory);

  const runs: { systemPromptFile?: string; permissionMode?: string; cwd?: string }[] = [];
  const runner: EngineRunner = (options) => {
    runs.push({
      systemPromptFile: options.systemPromptFile,
      permissionMode: options.permissionMode,
      cwd: options.cwd,
    });
    const run: EngineRun = {
      engine: "claude-code",
      sessionId: options.sessionId ?? "mock",
      transcriptPath: null,
      text: "done",
      structured: null,
      costUsd: 0.05,
      durationMs: 50,
      turns: 1,
      isError: false,
      permissionDenials: [],
      actions: options.systemPromptFile
        ? [{ tool: "Edit", path: "src/index.ts", command: null }]
        : [{ tool: "Read", path: "README.md", command: null }],
    };
    return Promise.resolve(run);
  };

  const receipt = await runEval({
    paths,
    configPath: paths.configFile,
    runner,
  });

  expect(runs.length).toBe(2);
  expect(runs[0]?.systemPromptFile).toBeUndefined();
  expect(runs[0]?.permissionMode).toBe("dontAsk");
  expect(runs[1]?.systemPromptFile).toBeDefined();
  expect(runs[1]?.permissionMode).toBe("dontAsk");

  expect(runs[0]?.cwd).not.toBe(os.tmpdir());
  expect(runs[1]?.cwd).not.toBe(os.tmpdir());
  expect(runs[0]?.cwd).not.toBe(runs[1]?.cwd);
  expect(await Bun.file(runs[0]?.cwd ?? "").exists()).toBeFalse();
  expect(await Bun.file(runs[1]?.cwd ?? "").exists()).toBeFalse();

  expect(receipt.sessionsEvaluated).toBe(1);
  expect(receipt.sessionsSkipped).toBe(0);
  expect(receipt.averageDelta.total).toBeGreaterThan(0);
  expect(receipt.sessions[0]?.baselineSessionId).toBeDefined();
  expect(receipt.sessions[0]?.cloneSessionId).toBeDefined();

  const receiptFile = path.join(
    paths.shadowcloneDirectory,
    "eval",
    `${receipt.evalId}.json`,
  );
  expect(await Bun.file(receiptFile).exists()).toBeTrue();
});

test("runEval skips a session whose baseline replay failed", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-eval-fail-"),
  );
  const paths = await setupTestEnvironment(homeDirectory);

  const failingRunner: EngineRunner = () =>
    Promise.resolve({
      engine: "claude-code",
      sessionId: "mock-fail",
      transcriptPath: null,
      text: "",
      structured: null,
      costUsd: 0,
      durationMs: 10,
      turns: 1,
      isError: true,
      permissionDenials: [],
    });

  const receipt = await runEval({
    paths,
    configPath: paths.configFile,
    runner: failingRunner,
  });

  expect(receipt.sessionsEvaluated).toBe(0);
  expect(receipt.sessionsSkipped).toBe(1);

  const receiptFile = path.join(
    paths.shadowcloneDirectory,
    "eval",
    `${receipt.evalId}.json`,
  );
  expect(await Bun.file(receiptFile).exists()).toBeTrue();
});
