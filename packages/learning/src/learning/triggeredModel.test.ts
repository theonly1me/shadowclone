import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { integrationFixture } from "@shadowclone/core/testing";
import { installIntegration, nativeSessionEnd } from "@shadowclone/environment";
import { defaultConfig, writeConfig } from "@shadowclone/core";
import { runAutomaticLearning } from "./worker";
import { readLatestLearningReceipt } from "./receipt";
import type { EngineRunner } from "@shadowclone/agents";

test("a session model without its harness never reaches the saved learning engine", async () => {
  const fixture = await integrationFixture();
  try {
    await writeConfig({ configPath: fixture.paths.configFile, config: {
      ...defaultConfig, sources: { ...defaultConfig.sources, pi: true },
      distillation: { deep: true, automatic: true, engine: "claude-code", model: "saved-model" },
    } });
    const integration = await installIntegration({ ...fixture, agent: "pi", scope: "global" });
    const sourcePath = path.join(fixture.paths.piSessionsDirectory, "synthetic/session.jsonl");
    await Bun.write(sourcePath, [
      { type: "session", version: 3, id: "synthetic", cwd: fixture.cwd },
      { type: "message", id: "prompt", parentId: null, timestamp: "2026-10-01T00:00:00.000Z", message: { role: "user", content: "Always use explicit parameter names." } },
    ].map(value => JSON.stringify(value)).join("\n") + "\n");
    const sessionKey = await nativeSessionEnd({ ...fixture, id: integration.id, input: JSON.stringify({ cwd: fixture.cwd, session_id: "synthetic" }) });
    if (!sessionKey) throw new Error("Missing synthetic session identity");
    const models: (string | undefined)[] = [];
    const runner: EngineRunner = async options => {
      models.push(options.model);
      return { engine: "claude-code", sessionId: "synthetic-learning", transcriptPath: null, text: "", structured: { existingRules: [], newRules: [], assessments: [] }, costUsd: 0, durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
    };
    expect(await runAutomaticLearning({ ...fixture, runner, model: "gpt-6.1", sessionKeys: [sessionKey] })).toBe("completed");
    expect(models).toEqual(["saved-model"]);
    expect((await readLatestLearningReceipt(fixture.paths))?.model).toBe("saved-model");
  } finally { await rm(fixture.home, { recursive: true, force: true }); }
});
