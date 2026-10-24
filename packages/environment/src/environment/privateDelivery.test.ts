import { expect, test } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { canonicalPath } from "@shadowclone/core";
import { readMaintenanceState } from "@shadowclone/skills";
import { normalizeRemoteRepository } from "@shadowclone/sessions";
import { installIntegration } from "../integrations/install";
import { nativeSessionStart } from "../integrations/hooks";
import { environmentCompilation, renderSkillRouting } from "./context";
import { learningRecord } from "./fixtures";
import { recordLearningNotice } from "./learningNotice";
import { registerWorkingRepository } from "./registerRepository";
import { learningScopes, skillDirectories } from "./scope";
import { readEnvironment, writeEnvironment } from "./store";
import { skillFixture } from "./testing";
import { emptyEnvironment, learningRuleSchema } from "./types";

const remote = "git@github.com:synthetic-org/tally.git";

test("a private repository choice keeps learnings outside the repository and ends the one-time question", async () => {
  const setup = await skillFixture();
  try {
    const workspace = path.join(setup.home, "tally");
    await mkdir(workspace);
    const repository = normalizeRemoteRepository(remote);
    if (!repository?.profileFileName) throw new Error("Expected a synthetic repository identity");
    const identity = {
      originDirectory: repository.origin.directoryName,
      repositoryName: repository.profileFileName,
    };
    const record = learningRecord({ key: "mined:tally-rule" });
    await writeEnvironment({
      paths: setup.paths,
      state: {
        ...emptyEnvironment,
        phase: "active",
        records: [
          {
            ...record,
            rule: learningRuleSchema.parse({ ...record.rule, scope: "project", ...identity }),
          },
        ],
      },
    });
    const context = async () =>
      (
        await environmentCompilation({
          paths: setup.paths,
          cwd: workspace,
          scope: "scoped",
          ...identity,
        })
      )?.markdown ?? "";

    expect(await context()).toContain("Ask the user once whether to keep them private");

    const registered = await registerWorkingRepository({
      paths: setup.paths,
      workingDirectory: workspace,
      gitMetadataEnabled: true,
      blockedOrigins: [],
      managedConfigPath: null,
      readRemote: async () => remote,
      delivery: "private",
    });
    const privateDirectory = registered?.privateSkillsDirectory ?? "";
    expect(privateDirectory.startsWith(canonicalPath(setup.paths.shadowcloneDirectory))).toBe(true);

    const state = await readEnvironment(setup.paths);
    const scope = state
      ? learningScopes({ paths: setup.paths, state }).find(({ repository }) => repository !== null)
      : undefined;
    expect(scope ? skillDirectories(scope) : []).toEqual([privateDirectory]);
    expect(
      (await readMaintenanceState(setup.paths)).roots
        .filter(({ scope: rootScope }) => rootScope === "repository")
        .map(({ directory, cwd }) => ({ directory, cwd })),
    ).toEqual([{ directory: privateDirectory, cwd: canonicalPath(workspace) }]);
    expect(await context()).not.toContain("Ask the user once");
    expect(await readdir(workspace)).toEqual([]);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("the next session hears about triage changes once", async () => {
  const setup = await skillFixture();
  try {
    const integration = await installIntegration({
      ...setup,
      agent: "claude-code",
      scope: "global",
    });
    await recordLearningNotice({
      paths: setup.paths,
      applied: ["Use complete parameter names"],
      discarded: [],
      revisions: ["synthetic-revision"],
    });
    const start = async () =>
      JSON.stringify(
        await nativeSessionStart({
          ...setup,
          id: integration.id,
          input: JSON.stringify({ cwd: setup.cwd, session_id: "synthetic-session" }),
        }),
      );

    const first = await start();
    expect(first).toContain('It applied 1: \\"Use complete parameter names\\"');
    expect(first).toContain("synthetic-revision");
    expect(await start()).not.toContain("shadowclone triaged");
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("a private repository skill uses a catalog inside its private directory", () => {
  const repository = {
    directory: "/work/tally",
    originDirectory: "github.com--synthetic-org",
    repositoryName: "tally",
    privateSkillsDirectory: "/home/synthetic/.shadowclone/builds/learning-1/skills",
  };
  const filePath = `${repository.privateSkillsDirectory}/tally-checks/SKILL.md`;
  const text = renderSkillRouting({
    scopes: [
      { key: "github.com--synthetic-org/tally", directory: repository.directory, repository },
    ],
    state: {
      ...emptyEnvironment,
      artifacts: [
        {
          filePath,
          fingerprint: "hash",
          original: null,
          kind: "skill",
          scope: "github.com--synthetic-org/tally",
          name: "tally-checks",
          description: "Check tally totals.",
          learningKeys: [],
        },
      ],
    },
  });
  expect(text).toContain(`${repository.privateSkillsDirectory}/shadowclone-guidance/catalog.md`);
  expect(text).not.toContain("Check tally totals.");
});
