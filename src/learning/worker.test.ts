import { expect, test } from "bun:test";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import type { EngineRunner } from "../engine";
import { integrationFixture } from "../integrations/fixtures";
import { acquireLocalLock } from "../localFiles/lock";
import {
  learningSessionKey,
  runAutomaticLearning,
  scheduleLearning,
} from "./index";
import { learningInterval, readLearningState } from "./state";

const now = Date.parse("2026-09-11T09:00:00Z");
const emptyRunner: EngineRunner = () => Promise.resolve({ engine: "claude-code", sessionId: "internal", transcriptPath: null, text: "", structured: { existingRules: [], newRules: [], assessments: [] }, costUsd: 0.01, durationMs: 1, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null });

async function fixture(sessionCount: number) {
  const setup = await integrationFixture();
  await writeConfig({ configPath: setup.paths.configFile, config: { ...defaultConfig, sources: { ...defaultConfig.sources, "claude-code": true }, distillation: { deep: true, automatic: true } } });
  const records = Array.from({ length: sessionCount }, (_, position) => ({ type: "user", sessionId: `session-${position}`, uuid: `event-${position}`, timestamp: new Date(now - 10_000 + position).toISOString(), cwd: setup.cwd, message: { content: `In session ${position}, always use complete variable names.` } }));
  await Bun.write(path.join(setup.paths.claudeProjectsDirectory, "fixture", "sessions.jsonl"), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return setup;
}

test("automatic learning stays off without separate consent and internal runs do not schedule", async () => {
  const setup = await integrationFixture();
  let spawns = 0;
  expect(await runAutomaticLearning(setup)).toBe("disabled");
  expect(await scheduleLearning({ ...setup, spawn: () => { spawns += 1; } })).toBeFalse();
  const enabled = await fixture(1);
  expect(await scheduleLearning({ ...enabled, internalRun: true, spawn: () => { spawns += 1; } })).toBeFalse();
  expect(spawns).toBe(0);
});

test("worker serializes attempts and processes at most sixty unseen recent episodes per hour", async () => {
  const setup = await fixture(65);
  const lock = await acquireLocalLock(path.join(setup.paths.shadowcloneDirectory, "learning-worker.db"));
  if (!lock) throw new Error("Fixture lock was unavailable");
  try { expect(await runAutomaticLearning({ ...setup, now })).toBe("busy"); }
  finally { lock.release(); }
  let calls = 0;
  const runner: EngineRunner = (options) => { calls += 1; return emptyRunner(options); };
  expect(await runAutomaticLearning({ ...setup, now, runner, engine: "claude-code" })).toBe("completed");
  expect((await readLearningState(setup.paths)).processed).toHaveLength(60);
  expect(calls).toBe(3);
  expect(await runAutomaticLearning({ ...setup, now: now + 1000, runner, engine: "claude-code" })).toBe("deferred");
  expect(await runAutomaticLearning({ ...setup, now: now + learningInterval, runner, engine: "claude-code" })).toBe("completed");
  expect((await readLearningState(setup.paths)).processed).toHaveLength(65);
  expect(calls).toBe(4);
  expect(await runAutomaticLearning({ ...setup, now: now + 2 * learningInterval, runner, engine: "claude-code" })).toBe("completed");
  expect(calls).toBe(4);
});

test("the ledger keeps episodes it processed more than thirty days ago", async () => {
  const setup = await fixture(65);
  const runner: EngineRunner = (options) => emptyRunner(options);
  expect(await runAutomaticLearning({
    ...setup,
    now,
    runner,
    engine: "claude-code",
  })).toBe("completed");
  expect((await readLearningState(setup.paths)).processed).toHaveLength(60);

  expect(await runAutomaticLearning({
    ...setup,
    now: now + 31 * 24 * learningInterval,
    runner,
    engine: "claude-code",
  })).toBe("completed");

  expect((await readLearningState(setup.paths)).processed).toHaveLength(65);
});

test("a failed attempt preserves the profile and can retry at a later boundary", async () => {
  const setup = await fixture(1);
  const filePath = path.join(setup.paths.profileDirectory, "global/engineering.md");
  const before = await Bun.file(filePath).text();
  const failingRunner: EngineRunner = () => Promise.reject(new Error("Fixture engine failure"));
  expect(await runAutomaticLearning({ ...setup, now, runner: failingRunner, engine: "claude-code" })).toBe("failed");
  expect(await Bun.file(filePath).text()).toBe(before);
  expect((await readLearningState(setup.paths)).processed).toEqual([]);
  expect(await runAutomaticLearning({ ...setup, now: now + learningInterval, runner: emptyRunner, engine: "claude-code" })).toBe("completed");
});

test("a requested session is learned even when older episodes fill the batch", async () => {
  const setup = await fixture(65);
  const prompts: string[] = [];
  const runner: EngineRunner = (options) => {
    prompts.push(options.prompt);
    return emptyRunner(options);
  };
  const sessionKeys = [learningSessionKey({
    agent: "claude-code",
    nativeSessionId: "session-64",
  })];

  expect(await runAutomaticLearning({
    ...setup,
    now,
    runner,
    engine: "claude-code",
    sessionKeys,
  })).toBe("completed");

  expect(prompts.join("\n")).toContain(
    "In session 64, always use complete variable names.",
  );
  expect((await readLearningState(setup.paths)).processed).toHaveLength(1);
});

test("a requested session bypasses the interval and learns only that session", async () => {
  const setup = await fixture(3);
  const prompts: string[] = [];
  const runner: EngineRunner = (options) => {
    prompts.push(options.prompt);
    return emptyRunner(options);
  };
  const sessionKeys = [learningSessionKey({
    agent: "claude-code",
    nativeSessionId: "session-1",
  })];
  expect(await runAutomaticLearning({
    ...setup,
    now,
    runner,
    engine: "claude-code",
    sessionKeys,
  })).toBe("completed");
  expect((await readLearningState(setup.paths)).processed).toHaveLength(1);
  expect(prompts.join("\n")).toContain(
    "In session 1, always use complete variable names.",
  );
  expect(prompts.join("\n")).not.toContain(
    "In session 0, always use complete variable names.",
  );

  let spawns = 0;
  expect(await scheduleLearning({
    ...setup,
    now: now + 1_000,
    sessionKeys,
    spawn: () => {
      spawns += 1;
    },
  })).toBeTrue();
  expect(spawns).toBe(1);
});
