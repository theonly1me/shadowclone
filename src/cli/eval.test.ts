import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import type { EngineRunner } from "../engine";
import { openEventIndex } from "../index";
import { createProjectPaths } from "../paths";
import { evalCommand } from "./eval";

test("evalCommand prompts with cost preview when interactive and cancels if declined", async () => {
  let askedQuestion = "";
  const questions: string[] = [];
  const ask = (question: string) => {
    askedQuestion = question;
    questions.push(question);
    return false;
  };

  const originalIsTTY = process.stdin.isTTY;
  try {
    process.stdin.isTTY = true;
    await evalCommand(["--sessions", "5", "--max-budget-usd", "0.20"], { ask });
    expect(askedQuestion).toContain("5 sessions");
    expect(askedQuestion).toContain("$2.00 budget");
    expect(questions.length).toBe(1);
  } finally {
    process.stdin.isTTY = originalIsTTY;
  }
});

test("evalCommand skips confirmation when --yes flag is present", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-cli-eval-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await mkdir(paths.profileDirectory, { recursive: true });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });

  const index = await openEventIndex(paths.indexDatabase);
  index.close();

  const questions: string[] = [];
  const ask = (question: string) => {
    questions.push(question);
    return false;
  };

  let runnerCalled = false;
  const runner: EngineRunner = () => {
    runnerCalled = true;
    return Promise.resolve({
      engine: "claude-code",
      sessionId: "mock",
      transcriptPath: null,
      text: "",
      structured: null,
      costUsd: 0,
      durationMs: 0,
      turns: 1,
      isError: false,
      permissionDenials: [],
    });
  };

  const originalIsTTY = process.stdin.isTTY;
  try {
    process.stdin.isTTY = true;
    await evalCommand(["--yes", "--sessions", "1"], { ask, runner, paths });
    expect(questions.length).toBe(0);
    expect(runnerCalled).toBe(false);
  } finally {
    process.stdin.isTTY = originalIsTTY;
  }
});
