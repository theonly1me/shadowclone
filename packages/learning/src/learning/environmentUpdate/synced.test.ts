import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createLearningExecution } from "@shadowclone/agents";
import { emptyEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { updateLearningEnvironment } from "./update";

const catalogSchema = z.object({ skills: z.array(z.object({ id: z.string(), name: z.string() })) });

test("learning never edits a skill that another product syncs into ~/.claude/skills/synced", async () => {
  const setup = await skillFixture();
  const record = learningRecord();
  const syncedPath = path.join(setup.home, ".claude/skills/synced/workspace-1/typed-changes/SKILL.md");
  let selectedSkillId = "";

  await rm(path.dirname(setup.filePath), { recursive: true });
  await Bun.write(syncedPath, setup.original);
  await writeEnvironment({ paths: setup.paths, state: { ...emptyEnvironment, automatic: true, records: [record] } });

  const execution = createLearningExecution({
    engine: "claude-code",
    runner: async (run) => {
      if (run.prompt.includes("Organize durable")) {
        const catalog = catalogSchema.parse(JSON.parse(run.prompt.split("\n\n").at(-1) ?? "{}"));
        selectedSkillId = catalog.skills.find(({ name }) => name === "typed-changes")?.id ?? "";

        return skillEngineRun({
          routes: [{
            key: record.rule.key,
            destination: "skill",
            skillId: selectedSkillId,
            name: "typed-changes",
            description: "Use for typed changes",
            reason: "Applies to this workflow",
          }],
        });
      }

      return skillEngineRun({
        outcomes: [{ key: record.rule.key, disposition: "apply", reason: "Supported" }],
        description: "Make typed code changes.",
        body: selectedSkillId === "" ? `# Typed changes\n\n${record.rule.body}\n` : "",
        edits: selectedSkillId === "" ? [] : [{
          before: "Preserve the requested behavior.",
          after: `Preserve the requested behavior. ${record.rule.body}`,
          keys: [record.rule.key],
        }],
      });
    },
  });

  try {
    await updateLearningEnvironment({ ...setup, execution });

    expect(await Bun.file(syncedPath).text()).toBe(setup.original);
    expect(selectedSkillId).toBe("");
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
