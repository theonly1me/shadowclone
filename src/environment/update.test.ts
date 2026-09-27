import { expect, test } from "bun:test";
import path from "node:path";
import { createLearningExecution } from "../engine";
import { fingerprint } from "../localFiles";
import { listRevisions, undoRevision } from "../changes";
import { skillFixture, skillEngineRun } from "../skillMaintenance/fixtures";
import { writeProfile, readProfileSnapshot } from "../profile";
import { emptyEnvironment } from "./types";
import { readEnvironment, writeEnvironment } from "./store";
import { learningRecord } from "./fixtures";
import { updateLearningEnvironment } from "./update";

async function setupLearning() {
  const setup = await skillFixture();
  const record = learningRecord();
  await writeEnvironment({ paths: setup.paths, state: { ...emptyEnvironment, automatic: true, records: [record] } });
  let calls = 0;
  const execution = createLearningExecution({ engine: "claude-code", runner: async (run) => {
    calls += 1;
    expect(run.allowedTools).toEqual([]);
    if (run.prompt.includes("Organize durable")) return skillEngineRun({ routes: [{ key: record.rule.key, destination: "skill", skillId: fingerprint(setup.filePath), name: "typed-changes", description: "Use for typed changes", reason: "Applies to this workflow" }] });
    return skillEngineRun({ status: "ready", reason: "Supported", accountedKeys: [record.rule.key], description: "", body: "", edits: [{ before: "Preserve the requested behavior.", after: `Preserve the requested behavior. ${record.rule.body}`, keys: [record.rule.key] }] });
  } });
  return { ...setup, record, execution, calls: () => calls };
}

test("learning maintains a skill, publishes portable copies, and skips unchanged evidence", async () => {
  const setup = await setupLearning();
  const first = await updateLearningEnvironment(setup);
  expect(first?.applied).toBe(1);
  expect(await Bun.file(setup.filePath).text()).toContain(setup.record.rule.body);
  expect(await Bun.file(path.join(setup.home, ".agents/skills/typed-changes/SKILL.md")).text()).toBe(await Bun.file(setup.filePath).text());
  expect((await readEnvironment(setup.paths))?.dispositions[0]?.status).toBe("published");
  await updateLearningEnvironment(setup);
  expect(setup.calls()).toBe(2);
  expect(await Bun.file(setup.paths.compiledProfileFile).exists()).toBeFalse();
});

test("undo restores every skill copy and its publication record", async () => {
  const setup = await setupLearning();
  await updateLearningEnvironment(setup);
  const revision = (await listRevisions(setup.paths)).find(({ files }) => files > 1);
  if (!revision) throw new Error("Expected a publication revision");
  await undoRevision({ paths: setup.paths, id: revision.id });
  expect(await Bun.file(setup.filePath).text()).toBe(setup.original);
  expect(await Bun.file(path.join(setup.home, ".agents/skills/typed-changes/SKILL.md")).exists()).toBeFalse();
  expect((await readEnvironment(setup.paths))?.dispositions).toEqual([]);
});

test("new learning uses the internal store and leaves legacy markdown unchanged", async () => {
  const setup = await setupLearning();
  const original = await Bun.file(path.join(setup.paths.profileDirectory, "global/engineering.md")).text();
  const record = learningRecord({ key: "detailed", body: "Preserve this complete condition. ".repeat(80) });
  await writeProfile({ paths: setup.paths, rules: [record.rule] });
  expect((await readProfileSnapshot(setup.paths)).rules.find(({ rule }) => rule.key === "detailed")?.promptBody).toBe(record.rule.body);
  expect(await Bun.file(path.join(setup.paths.profileDirectory, "global/engineering.md")).text()).toBe(original);
});
