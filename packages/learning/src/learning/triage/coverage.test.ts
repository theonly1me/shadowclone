import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createLearningExecution, type EngineRunner } from "@shadowclone/agents";
import { readConfig, writeConfig } from "@shadowclone/core";
import { emptyEnvironment, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { triagePendingLearning } from "./index";

const instruction = "Reject duplicate palette entries before an export.";

test("a deferred proposal is discarded after its rule appears in maintained guidance", async () => {
  const setup = await skillFixture();
  try {
    const config = await readConfig({ configPath: setup.paths.configFile });
    await writeConfig({
      configPath: setup.paths.configFile,
      config: { ...config, sources: { ...config.sources, "agent-context": true } },
    });
    await writeEnvironment({
      paths: setup.paths,
      state: {
        ...emptyEnvironment,
        phase: "active",
        records: [learningRecord({ key: "mined:palette", body: instruction })],
      },
    });
    const prompts: string[] = [];
    const runner: EngineRunner = async (run) => {
      prompts.push(run.prompt);
      const maintained = run.prompt.split("Guidance the user already maintains")[1] ?? "";
      const covered = maintained.includes(instruction);
      return skillEngineRun({
        decisions: [
          {
            token: "learning-1",
            verdict: covered ? "discard" : "defer",
            reason: covered ? "skill-covered" : "",
            note: "Synthetic coverage decision",
          },
        ],
      });
    };
    const execution = createLearningExecution({ engine: "claude-code", runner });
    expect(await triagePendingLearning({ paths: setup.paths, execution })).toEqual({
      applied: 0,
      discarded: 0,
      deferred: 1,
    });
    expect(await triagePendingLearning({ paths: setup.paths, execution })).toEqual({
      applied: 0,
      discarded: 0,
      deferred: 0,
    });
    expect(prompts).toHaveLength(1);
    await Bun.write(path.join(setup.home, ".codex/AGENTS.md"), `${instruction}\n`);
    expect(await triagePendingLearning({ paths: setup.paths, execution })).toEqual({
      applied: 0,
      discarded: 1,
      deferred: 0,
    });
    expect((await readEnvironment(setup.paths))?.rejected).toContain("mined:palette");
    expect(prompts).toHaveLength(2);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
