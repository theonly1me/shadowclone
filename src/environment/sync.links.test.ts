import { expect, test } from "bun:test";
import { readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { installedBuild } from "../builds/syncFixtures";
import { installIntegration } from "../integrations/install";
import { updateManagedSection } from "../integrations/markdown";
import { readIntegrations, saveIntegration } from "../integrations/state";
import { syncLearningEnvironment } from "./sync";

async function linkedCodexInstructions() {
  const setup = await installedBuild();

  await installIntegration({ paths: setup.paths, cwd: setup.cwd, agent: "claude-code", scope: "global" });
  await installIntegration({ paths: setup.paths, cwd: setup.cwd, agent: "codex", scope: "global" });

  const claude = path.join(setup.home, ".claude/CLAUDE.md");
  const codex = path.join(setup.home, ".codex/AGENTS.md");
  const shared = path.join(setup.home, "shared/AGENTS.md");
  const sharedText = (await Bun.file(codex).text()).replace("verify-and-review", "an-old-skill");

  await Bun.write(shared, sharedText);
  await rm(codex);
  await symlink(shared, codex);

  const olderSection = updateManagedSection({ previous: null, body: "# Shadowclone guidance\n\n- when testing: an-old-skill\n" });
  const claudeIntegration = (await readIntegrations(setup.paths)).find((entry) => entry.agent === "claude-code");

  if (!claudeIntegration) throw new Error("The Claude Code integration was not installed");

  await Bun.write(claude, olderSection.text);
  await saveIntegration({
    paths: setup.paths,
    integration: {
      ...claudeIntegration,
      files: claudeIntegration.files.map((file) =>
        file.relativePath.endsWith("CLAUDE.md") ? { ...file, fingerprint: olderSection.fingerprint } : file,
      ),
    },
  });

  return { ...setup, claude, codex, shared, sharedText };
}

test("sync updates every other agent and reports an instruction file that is a link", async () => {
  const setup = await linkedCodexInstructions();
  const skipped: unknown[] = [];

  expect(await syncLearningEnvironment(setup.paths, { onSkipped: (entries) => skipped.push(...entries) })).toBeTrue();

  expect(skipped).toEqual([{ agent: "codex", path: setup.codex, target: setup.shared }]);
  expect(await Bun.file(setup.claude).text()).toContain(": verify-and-review");
  expect(await Bun.file(setup.claude).text()).not.toContain("an-old-skill");
  expect(await readlink(setup.codex)).toBe(setup.shared);
  expect(await Bun.file(setup.shared).text()).toBe(setup.sharedText);
  expect((await readIntegrations(setup.paths)).some((entry) => entry.agent === "codex")).toBeTrue();
});

test("callers that do not ask for skips still stop at a linked instruction file", async () => {
  const setup = await linkedCodexInstructions();

  await expect(syncLearningEnvironment(setup.paths)).rejects.toThrow("Destination must be a regular file without symbolic links");
  expect(await Bun.file(setup.shared).text()).toBe(setup.sharedText);
});
