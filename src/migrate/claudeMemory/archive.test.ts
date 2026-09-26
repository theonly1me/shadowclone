import { expect, test } from "bun:test";
import path from "node:path";
import { archiveClaudeMemory } from "./archive";
import { migrateClaudeMemory } from "./migrate";
import { claudeMemoryFixture } from "./testFixture";

test("archive verifies the revision and preserves a complete backup", async () => {
  const setup = await claudeMemoryFixture();
  const migrated = await migrateClaudeMemory({
    paths: setup.paths,
    cwd: setup.repositoryRoot,
    repositoryRoot: setup.repositoryRoot,
    apply: true,
    decisions: setup.decisions,
    managedConfigPath: null,
    readRemote: async () => "git@github.com:acme/sample-app.git",
    now: 1_789_689_600_000,
  });
  if (migrated.revisionId === null) throw new Error("Migration must create a revision");
  const archived = await archiveClaudeMemory({
    paths: setup.paths,
    revisionId: migrated.revisionId,
    managedConfigPath: null,
    now: 1_789_689_600_000,
  });
  expect(archived.archived).toBe(4);
  expect(archived.activeProjects).toBe(0);
  expect(await Bun.file(path.join(
    archived.backupDirectory,
    "feedback_prefer_bun.md",
  )).exists()).toBeTrue();
  expect(await Bun.file(path.join(setup.directory, "feedback_prefer_bun.md")).exists())
    .toBeFalse();
  expect(await Bun.file(path.join(setup.directory, "reference_queue.md")).exists())
    .toBeFalse();
  expect(await Bun.file(path.join(
    archived.backupDirectory,
    "project_active.md",
  )).exists()).toBeTrue();
  expect(await Bun.file(path.join(setup.directory, "project_active.md")).exists())
    .toBeFalse();
  expect(await Bun.file(path.join(setup.directory, "MEMORY.md")).exists())
    .toBeFalse();
});
