import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createLearningExecution } from "@shadowclone/agents";
import { fingerprint } from "@shadowclone/core";
import { emptyEnvironment, installIntegration, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { updateLearningEnvironment } from "./environmentUpdate/update";

test("an edited routing section in one agent's instructions does not stop skill publication", async () => {
  const fixture = await skillFixture();
  const record = learningRecord({ body: "Use complete parameter names when editing typed code." });
  try {
    await writeEnvironment({ paths: fixture.paths, state: { ...emptyEnvironment, phase: "active", automatic: true, records: [record] } });
    await installIntegration({ ...fixture, agent: "codex", scope: "global" });
    const instructions = path.join(fixture.home, ".codex/AGENTS.md");
    const edited = (await Bun.file(instructions).text()).replace("</shadowclone-guidance>", "- my own routing line\n</shadowclone-guidance>");
    await Bun.write(instructions, edited);
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

    expect((await updateLearningEnvironment({ ...fixture, execution }))?.applied).toBe(1);
    expect(await Bun.file(fixture.filePath).text()).toContain(record.rule.body);
    expect((await readEnvironment(fixture.paths))?.dispositions[0]?.status).toBe("published");
    expect(await Bun.file(instructions).text()).toBe(edited);
  } finally { await rm(fixture.home, { recursive: true, force: true }); }
});
