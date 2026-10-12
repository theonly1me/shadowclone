import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createLearningExecution } from "@shadowclone/agents";
import { fingerprint } from "@shadowclone/core";
import { emptyEnvironment, installIntegration, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { updateLearningEnvironment } from "./environmentUpdate/update";

async function publishAfterEditing(options: {
  readonly relativePath: string;
  readonly edit: (text: string) => string;
}) {
  const fixture = await skillFixture();
  const record = learningRecord({ body: "Use complete parameter names when editing typed code." });
  try {
    await writeEnvironment({ paths: fixture.paths, state: { ...emptyEnvironment, phase: "active", automatic: true, records: [record] } });
    await installIntegration({ ...fixture, agent: "codex", scope: "global" });
    const editedPath = path.join(fixture.home, options.relativePath);
    const edited = options.edit(await Bun.file(editedPath).text());
    await Bun.write(editedPath, edited);
    const execution = createLearningExecution({
      engine: "claude-code",
      limits: { maximumCalls: 10, maximumCostUsd: 2, timeoutMilliseconds: 60_000 },
      runner: async (run) => run.prompt.includes("Organize durable")
        ? skillEngineRun({ routes: [{ key: record.rule.key, destination: "skill", skillId: fingerprint(fixture.filePath), name: "typed-changes", description: "Use for typed code changes.", reason: "Applies to this workflow" }] })
        : skillEngineRun({
          outcomes: [{ key: record.rule.key, disposition: "apply", reason: "Supported" }],
          description: "Use complete parameter names when changing typed code.", body: "",
          edits: [{ before: "Preserve the requested behavior.", after: `Preserve the requested behavior. ${record.rule.body}`, keys: [record.rule.key] }],
        }),
    });

    return {
      applied: (await updateLearningEnvironment({ ...fixture, execution }))?.applied,
      skill: await Bun.file(fixture.filePath).text(),
      status: (await readEnvironment(fixture.paths))?.dispositions[0]?.status,
      editedFileKept: (await Bun.file(editedPath).text()) === edited,
      body: record.rule.body,
    };
  } finally { await rm(fixture.home, { recursive: true, force: true }); }
}

test("an edited routing section in one agent's instructions does not stop skill publication", async () => {
  const result = await publishAfterEditing({
    relativePath: ".codex/AGENTS.md",
    edit: (text) => text.replace("</shadowclone-guidance>", "- my own routing line\n</shadowclone-guidance>"),
  });

  expect(result).toMatchObject({ applied: 1, status: "published", editedFileKept: true });
  expect(result.skill).toContain(result.body);
});

test("an edited shadowclone hook in one agent's hook file does not stop skill publication", async () => {
  const result = await publishAfterEditing({
    relativePath: ".codex/hooks.json",
    edit: (text) => text.replace("\"timeout\": 10", "\"additionalContextLimit\": 6000,\n            \"timeout\": 10"),
  });

  expect(result).toMatchObject({ applied: 1, status: "published", editedFileKept: true });
  expect(result.skill).toContain(result.body);
});
