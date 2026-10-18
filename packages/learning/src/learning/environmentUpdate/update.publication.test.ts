import path from "node:path";
import { expect, test } from "bun:test";
import { createLearningExecution } from "@shadowclone/agents";
import { fingerprint } from "@shadowclone/core";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import {
  emptyEnvironment,
  pendingLearningRecords,
  readEnvironment,
  writeEnvironment,
} from "@shadowclone/environment";
import { updateLearningEnvironment } from "./update";

test("a publication failure names the error that stopped it", async () => {
  const setup = await skillFixture();
  const record = learningRecord();
  const occupiedPath = path.join(setup.home, ".agents/skills/typed-changes/SKILL.md");

  await Bun.write(
    occupiedPath,
    "---\nname: typed-changes\ndescription: Another skill.\n---\n\n# Another\n",
  );
  await writeEnvironment({
    paths: setup.paths,
    state: { ...emptyEnvironment, automatic: true, records: [record] },
  });

  const execution = createLearningExecution({
    engine: "claude-code",
    runner: async (run) => {
      if (run.prompt.includes("Organize durable")) {
        return skillEngineRun({
          routes: [
            {
              key: record.rule.key,
              destination: "skill",
              skillId: fingerprint(setup.filePath),
              name: "typed-changes",
              description: "Use for typed changes",
              reason: "Applies to this workflow",
            },
          ],
        });
      }

      return skillEngineRun({
        outcomes: [{ key: record.rule.key, disposition: "apply", reason: "Supported" }],
        description: "Make typed code changes and validate sample palettes.",
        body: "",
        edits: [
          {
            before: "Preserve the requested behavior.",
            after: `Preserve the requested behavior. ${record.rule.body}`,
            keys: [record.rule.key],
          },
        ],
      });
    },
  });

  await updateLearningEnvironment({ ...setup, execution });

  const state = await readEnvironment(setup.paths);

  if (state === null) {
    throw new Error("The update did not keep an environment.");
  }

  const reason = pendingLearningRecords({ paths: setup.paths, state }).find(
    (entry) => entry.key === record.rule.key,
  )?.reason;

  expect(reason).toContain("A different skill already occupies a publication destination");
});
