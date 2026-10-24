import path from "node:path";
import { fingerprint } from "@shadowclone/core";
import { learningRecord } from "./fixtures";
import { recordFingerprint } from "./records";
import { writeEnvironment } from "./store";
import { skillFixture } from "./testing";
import { emptyEnvironment } from "./types";

export const description = "Use when editing typed code.";
export const taskBody = "Check exported types.";
export const universalBody = "Preserve user-owned edits.";

export async function catalogFixture() {
  const setup = await skillFixture();
  const text = `---\nname: typed-changes\ndescription: ${description}\n---\n# Typed changes\n\n${taskBody}\n`;
  await Bun.write(setup.filePath, text);
  const universal = learningRecord({ key: "universal", body: universalBody });
  const task = learningRecord({ key: "task", body: taskBody });
  const state = {
    ...emptyEnvironment,
    phase: "active" as const,
    records: [universal, task],
    artifacts: [
      {
        filePath: setup.filePath,
        fingerprint: fingerprint(text),
        original: null,
        kind: "skill" as const,
        scope: "global",
        name: "typed-changes",
        description,
        learningKeys: ["task"],
      },
    ],
    dispositions: [universal, task].map((record) => ({
      scope: "global",
      key: record.rule.key,
      inputFingerprint: recordFingerprint(record),
      status: "published" as const,
      reason: "Published",
      destinations: [setup.filePath],
    })),
  };
  await writeEnvironment({ paths: setup.paths, state });
  return {
    ...setup,
    state,
    catalogPath: path.join(setup.home, ".agents/skills/shadowclone-guidance/catalog.md"),
  };
}
