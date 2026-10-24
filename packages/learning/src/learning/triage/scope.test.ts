import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { createLearningExecution, type EngineRunner } from "@shadowclone/agents";
import {
  emptyEnvironment,
  readEnvironment,
  writeEnvironment,
  type LearningRecord,
} from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { triagePendingLearning } from "./index";

const instruction = "Generate exports with the repository command.";

test("triage never uses a published repository rule to discard another repository's proposal", async () => {
  const setup = await skillFixture();
  try {
    const record = (key: string, repositoryName: string): LearningRecord => {
      const source = learningRecord({ key, body: instruction });
      return {
        ...source,
        rule: {
          ...source.rule,
          scope: "project",
          originDirectory: "synthetic-org",
          repositoryName,
        },
      };
    };
    const published = record("published", "palettes");
    await writeEnvironment({
      paths: setup.paths,
      state: {
        ...emptyEnvironment,
        phase: "active",
        records: [
          { ...published, rule: { ...published.rule, source: "imported" } },
          record("pending-palettes", "palettes"),
          record("pending-billing", "billing"),
        ],
        dispositions: [
          {
            key: "published",
            scope: "synthetic-org/palettes",
            inputFingerprint: "synthetic",
            status: "published",
            reason: "Published",
            destinations: [],
          },
        ],
      },
    });
    const runner: EngineRunner = async (run) => {
      const published =
        run.prompt
          .split("Published guidance\n")[1]
          ?.split("Guidance the user already maintains")[0] ?? "";
      const covered = published.includes(instruction);
      const decisions = [...run.prompt.matchAll(/(learning-\d+) \(project,/gu)].map(
        ([, token]) => ({
          token,
          verdict: covered ? "discard" : "defer",
          reason: covered ? "duplicate" : "",
          note: "Synthetic scope decision",
        }),
      );
      return skillEngineRun({ decisions });
    };
    const execution = createLearningExecution({ engine: "claude-code", runner });
    const summary = await triagePendingLearning({ paths: setup.paths, execution });
    expect(summary.discarded).toBe(1);
    expect((await readEnvironment(setup.paths))?.rejected).toEqual(["pending-palettes"]);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
