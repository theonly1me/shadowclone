import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createLearningExecution, type EngineRunner } from "@shadowclone/agents";
import { emptyEnvironment, writeEnvironment, type LearningRecord } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { triagePendingLearning } from "./index";

test("a scope that exceeds the current call budget remains eligible for the next run", async () => {
  const setup = await skillFixture();
  try {
    const records: LearningRecord[] = ["palettes", "billing"].map((repositoryName) => {
      const source = learningRecord({ key: repositoryName });
      return {
        ...source,
        rule: {
          ...source.rule,
          scope: "project",
          originDirectory: "synthetic-org",
          repositoryName,
        },
      };
    });
    await writeEnvironment({
      paths: setup.paths,
      state: { ...emptyEnvironment, phase: "active", records },
    });
    const prompts: string[] = [];
    const runner: EngineRunner = async (run) => {
      prompts.push(run.prompt);
      const decisions = [...run.prompt.matchAll(/(learning-\d+) \(project,/gu)].map(
        ([, token]) => ({
          token,
          verdict: "defer",
          reason: "",
          note: "Synthetic deferred decision",
        }),
      );
      return skillEngineRun({ decisions });
    };
    const execution = () =>
      createLearningExecution({
        engine: "claude-code",
        runner,
        limits: { maximumCalls: 1, maximumCostUsd: 2, timeoutMilliseconds: 60_000 },
      });
    expect(await triagePendingLearning({ paths: setup.paths, execution: execution() })).toEqual({
      applied: 0,
      discarded: 0,
      deferred: 2,
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("(project, palettes)");
    expect(await triagePendingLearning({ paths: setup.paths, execution: execution() })).toEqual({
      applied: 0,
      discarded: 0,
      deferred: 1,
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("(project, billing)");
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
