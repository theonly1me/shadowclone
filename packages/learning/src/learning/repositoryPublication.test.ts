import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createLearningExecution } from "@shadowclone/agents";
import { canonicalPath, fingerprint, readConfig, writeConfig } from "@shadowclone/core";
import { emptyEnvironment, learningRuleSchema, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { normalizeRemoteRepository } from "@shadowclone/sessions";
import { updateLearningEnvironment } from "./environmentUpdate/update";

const remote = "git@github.com:synthetic-org/tally.git";
const body = "Run the tally checks before you push.";

async function sharedRepositoryFixture() {
  const setup = await skillFixture({ scope: "repository" });
  Bun.spawnSync(["git", "init", "-q", setup.cwd]);
  Bun.spawnSync(["git", "-C", setup.cwd, "remote", "add", "origin", remote]);
  const config = await readConfig({ configPath: setup.paths.configFile });
  await writeConfig({ configPath: setup.paths.configFile, config: { ...config, sources: { ...config.sources, "git-metadata": true } } });
  const repository = normalizeRemoteRepository(remote);
  if (!repository?.profileFileName) throw new Error("Expected a synthetic repository identity");
  const identity = { originDirectory: repository.origin.directoryName, repositoryName: repository.profileFileName };
  const record = learningRecord({ key: "mined:tally-checks", body });
  await writeEnvironment({ paths: setup.paths, state: {
    ...emptyEnvironment, phase: "active", automatic: true,
    repositories: [{ directory: canonicalPath(setup.cwd), ...identity }],
    records: [{ ...record, rule: learningRuleSchema.parse({ ...record.rule, scope: "project", ...identity }) }],
  } });
  const execution = createLearningExecution({
    engine: "claude-code",
    limits: { maximumCalls: 10, maximumCostUsd: 2, timeoutMilliseconds: 60_000 },
    runner: async (run) => run.prompt.includes("Organize durable")
      ? skillEngineRun({ routes: [{ key: record.rule.key, destination: "skill", skillId: fingerprint(setup.filePath), name: "typed-changes", description: "Use for typed code changes.", reason: "Applies to this workflow" }] })
      : skillEngineRun({
        outcomes: [{ key: record.rule.key, disposition: "apply", reason: "Supported" }],
        description: "Use complete parameter names when changing typed code.", body: "",
        edits: [{ before: "Preserve the requested behavior.", after: `Preserve the requested behavior. ${body}`, keys: [record.rule.key] }],
      }),
  });

  return { setup, record, execution, readRemote: async () => remote };
}

test("automatic maintenance asks before it writes a learning into shared repository files", async () => {
  const { setup, record, execution, readRemote } = await sharedRepositoryFixture();
  try {
    expect((await updateLearningEnvironment({ ...setup, execution, readRemote }))?.applied).toBe(0);
    const disposition = (await readEnvironment(setup.paths))?.dispositions.find(({ key }) => key === record.rule.key);
    expect(disposition?.status).toBe("pending");
    expect(disposition?.reason).toContain("needs the user's approval");
    expect(await Bun.file(setup.filePath).text()).toBe(setup.original);
  } finally { await rm(setup.home, { recursive: true, force: true }); }
});

test("an approved repository learning edits the existing skill copy and adds no second copy", async () => {
  const { setup, record, execution, readRemote } = await sharedRepositoryFixture();
  try {
    expect((await updateLearningEnvironment({ ...setup, execution, readRemote, learningKeys: [record.rule.key] }))?.applied).toBe(1);
    expect(await Bun.file(setup.filePath).text()).toContain(body);
    expect(await Bun.file(path.join(setup.cwd, ".agents/skills/typed-changes/SKILL.md")).exists()).toBe(false);
  } finally { await rm(setup.home, { recursive: true, force: true }); }
});
