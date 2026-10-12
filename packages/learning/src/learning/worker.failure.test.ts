import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import type { EngineRunner } from "@shadowclone/agents";
import { runAutomaticLearning } from "./worker";
import { readLatestLearningReceipt } from "./receipt";
import { fixture, now } from "./worker.fixtures";

test("a failed learning run records why it failed without the home folder path", async () => {
  const setup = await fixture(1);
  try {
    const runner: EngineRunner = () => Promise.reject(
      new Error(`Claude rejected model gpt-6.1 for ${setup.home}/.shadowclone`),
    );

    expect(await runAutomaticLearning({ ...setup, runner, engine: "claude-code", now })).toBe("failed");

    const receipt = await readLatestLearningReceipt(setup.paths);
    expect(receipt?.outcome).toBe("engine-failed");
    expect(receipt?.engine).toBe("claude-code");
    expect(receipt?.failure).toBe("Claude rejected model gpt-6.1 for ~/.shadowclone");
  } finally { await rm(setup.home, { recursive: true, force: true }); }
});
