import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createLearningExecution, type EngineRunner } from "@shadowclone/agents";
import { fingerprint, readConfig, writeConfig } from "@shadowclone/core";
import { emptyEnvironment, readEnvironment, takeLearningNotice, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { triagePendingLearning } from "./index";

const coveredBody = "Never use the em dash in written output.";
const usefulBody = "Use complete parameter names when editing typed code.";
const duplicateBody = "Prefer complete parameter names in typed code.";

async function triageFixture(options: { readonly automatic: boolean }) {
  const fixture = await skillFixture();
  const config = await readConfig({ configPath: fixture.paths.configFile });
  await writeConfig({ configPath: fixture.paths.configFile, config: { ...config, sources: { ...config.sources, "agent-context": true } } });
  await Bun.write(path.join(fixture.home, ".codex/AGENTS.md"), `${coveredBody}\n`);
  const records = [
    learningRecord({ key: "mined:covered", body: coveredBody }),
    learningRecord({ key: "mined:useful", body: usefulBody }),
    learningRecord({ key: "mined:duplicate", body: duplicateBody }),
  ];
  await writeEnvironment({ paths: fixture.paths, state: { ...emptyEnvironment, phase: "active", automatic: options.automatic, records } });
  const prompts: string[] = [];
  const verdicts = new Map([
    [coveredBody, { verdict: "discard", reason: "skill-covered" }],
    [usefulBody, { verdict: "apply", reason: "" }],
    [duplicateBody, { verdict: "discard", reason: "duplicate" }],
  ]);
  const runner: EngineRunner = async (run) => {
    prompts.push(run.prompt);
    if (run.prompt.includes("Triage learned rules")) {
      const decisions = [...run.prompt.matchAll(/(learning-\d+) \(global\)\n[^\n]+\n([^\n]+)/gu)].map(([, token, body]) => ({
        token, ...verdicts.get(body ?? ""), note: "Synthetic decision",
      }));
      return skillEngineRun({ decisions });
    }
    if (run.prompt.includes("Organize durable")) {
      return skillEngineRun({ routes: [{ key: "mined:useful", destination: "skill", skillId: fingerprint(fixture.filePath), name: "typed-changes", description: "Use for typed code changes.", reason: "Applies to this workflow" }] });
    }
    return skillEngineRun({
      outcomes: [{ key: "mined:useful", disposition: "apply", reason: "Supported" }],
      description: "Use complete parameter names when changing typed code.", body: "",
      edits: [{ before: "Preserve the requested behavior.", after: `Preserve the requested behavior. ${usefulBody}`, keys: ["mined:useful"] }],
    });
  };
  const execution = createLearningExecution({ engine: "claude-code", runner, limits: { maximumCalls: 10, maximumCostUsd: 2, timeoutMilliseconds: 60_000 } });
  const triagePrompts = () => prompts.filter((prompt) => prompt.includes("Triage learned rules"));

  return { fixture, execution, triagePrompts };
}

test("triage discards covered and duplicate learnings, applies the useful one, and tells the next session once", async () => {
  const { fixture, execution, triagePrompts } = await triageFixture({ automatic: true });
  try {
    expect(await triagePendingLearning({ paths: fixture.paths, execution })).toEqual({ applied: 1, discarded: 2, deferred: 0 });
    expect(triagePrompts()[0]).toContain(`~/.codex/AGENTS.md\n${coveredBody}`);

    const state = await readEnvironment(fixture.paths);
    expect([...(state?.rejected ?? [])].sort()).toEqual(["mined:covered", "mined:duplicate"]);
    expect(state?.dispositions.find(({ key }) => key === "mined:useful")?.status).toBe("published");
    expect(await Bun.file(fixture.filePath).text()).toContain(usefulBody);

    const notice = await takeLearningNotice(fixture.paths);
    expect(notice).toContain("It applied 1:");
    expect(notice).toContain("It discarded 2 duplicate or covered rule(s)");
    expect(await takeLearningNotice(fixture.paths)).toBe("");

    await triagePendingLearning({ paths: fixture.paths, execution });
    expect(triagePrompts()).toHaveLength(1);
  } finally { await rm(fixture.home, { recursive: true, force: true }); }
});

test("without automatic maintenance, triage publishes nothing and does not ask about the same learning again", async () => {
  const { fixture, execution, triagePrompts } = await triageFixture({ automatic: false });
  try {
    expect(await triagePendingLearning({ paths: fixture.paths, execution })).toEqual({ applied: 0, discarded: 2, deferred: 1 });
    expect((await readEnvironment(fixture.paths))?.dispositions.some(({ status }) => status === "published")).toBe(false);
    expect(await Bun.file(fixture.filePath).text()).not.toContain(usefulBody);

    expect(await triagePendingLearning({ paths: fixture.paths, execution })).toEqual({ applied: 0, discarded: 0, deferred: 0 });
    expect(triagePrompts()).toHaveLength(1);
  } finally { await rm(fixture.home, { recursive: true, force: true }); }
});
