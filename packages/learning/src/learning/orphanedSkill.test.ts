import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createLearningExecution } from "@shadowclone/agents";
import { emptyEnvironment, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { updateLearningEnvironment } from "./environmentUpdate/update";
import { applyPreferencePreview, previewPreferenceEdit } from "./lifecycle";

test("retiring the only learning behind a skill that Shadowclone created removes the skill", async () => {
  const setup = await skillFixture();
  const record = learningRecord({ key: "mined:eval-harness", body: "Run evals locally and never push copies of third-party repositories." });
  const skillFolders = [".agents/skills/eval-harnesses", ".claude/skills/eval-harnesses"].map((folder) => path.join(setup.home, folder));
  let retiring = false;
  const execution = createLearningExecution({
    engine: "claude-code",
    limits: { maximumCalls: 10, maximumCostUsd: 2, timeoutMilliseconds: 60_000 },
    runner: async (run) => run.prompt.includes("Organize durable")
      ? skillEngineRun({ routes: [{ key: record.rule.key, destination: "skill", skillId: "", name: "eval-harnesses", description: "Use when building eval harnesses.", reason: "Scoped workflow" }] })
      : skillEngineRun({
        outcomes: [{ key: record.rule.key, disposition: "apply", reason: "Supported" }],
        description: "",
        edits: retiring ? [{ before: record.rule.body, after: "", keys: [record.rule.key] }] : [],
        body: retiring ? "" : `# Eval harnesses\n\n${record.rule.body}\n`,
      }),
  });
  try {
    await writeEnvironment({ paths: setup.paths, state: { ...emptyEnvironment, phase: "active", automatic: true, records: [record] } });
    await updateLearningEnvironment({ ...setup, execution });
    for (const folder of skillFolders) expect(await Bun.file(path.join(folder, "SKILL.md")).text()).toContain(record.rule.body);

    retiring = true;
    const preview = await previewPreferenceEdit({ paths: setup.paths, edit: { kind: "retire", key: record.rule.key } });
    await applyPreferencePreview({ paths: setup.paths, preview, execution });

    for (const folder of skillFolders) expect(await Bun.file(path.join(folder, "SKILL.md")).exists()).toBe(false);
    expect((await readEnvironment(setup.paths))?.artifacts.filter(({ name }) => name === "eval-harnesses")).toEqual([]);
  } finally { await rm(setup.home, { recursive: true, force: true }); }
});
