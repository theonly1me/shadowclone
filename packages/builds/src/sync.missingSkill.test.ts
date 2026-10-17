import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "@shadowclone/core";
import {
  environmentCompilation,
  installIntegration,
  materializeSkillDelivery,
  type MissingBuildSkill,
  readEnvironment,
  type SkippedRouting,
  syncLearningEnvironment,
} from "@shadowclone/environment";
import { writeMaintenanceState } from "@shadowclone/skills";
import { applyBuild } from "./apply";
import { buildCatalog } from "./catalog";
import { previewBuild } from "./plan";
import { buildFixture, buildInput } from "./testing";

const skillText = '---\nname: careful-review\ndescription: "Use when reviewing a change before handoff."\n---\n\nRead the whole diff.\n';
const skillRoots = [".agents/skills", ".claude/skills", ".gemini/config/skills"];

async function buildWithUserSkill() {
  const context = await buildFixture();
  const home = path.dirname(context.paths.shadowcloneDirectory);
  const skillFile = path.join(home, ".agents/skills/careful-review/SKILL.md");

  await writeConfig({
    config: { ...defaultConfig, sources: { ...defaultConfig.sources, "skill-library": true } },
    configPath: context.paths.configFile,
  });
  await Bun.write(skillFile, skillText);
  await writeMaintenanceState({
    paths: context.paths,
    state: {
      version: 1,
      roots: [
        {
          id: "0".repeat(64),
          directory: path.join(home, ".agents/skills"),
          cwd: home,
          scope: "global",
          owner: "user",
          destination: path.join(home, ".agents/skills"),
          enabled: true,
        },
      ],
      tracked: [],
      assessed: {},
      findings: {},
      rejected: {},
    },
  });

  const item = (await buildCatalog({ ...context, scope: "global" })).find((entry) => entry.name === "careful-review");

  if (!item) throw new Error("The user skill was not discovered");

  const input = buildInput({ choices: { "verify-and-review": true, [item.id]: true } });

  await applyBuild({ ...context, plan: await previewBuild({ ...context, input }) });
  await installIntegration({ paths: context.paths, cwd: context.cwd, agent: "codex", scope: "global" });

  return {
    ...context,
    home,
    skillFile,
    copies: skillRoots.map((root) => path.join(home, root, "careful-review/SKILL.md")),
    entryId: item.id,
    instructions: path.join(home, ".codex/AGENTS.md"),
  };
}

async function deleteEveryCopy(setup: Awaited<ReturnType<typeof buildWithUserSkill>>) {
  for (const copy of setup.copies) {
    await rm(path.dirname(copy), { recursive: true });
  }
}

async function syncReporting(setup: Awaited<ReturnType<typeof buildWithUserSkill>>) {
  const missing: MissingBuildSkill[] = [];
  const skipped: SkippedRouting[] = [];

  await syncLearningEnvironment(setup.paths, {
    onMissingSkills: (skills) => missing.push(...skills),
    onSkipped: (entries) => skipped.push(...entries),
  });

  return { missing, skipped, routing: await Bun.file(setup.instructions).text() };
}

async function sessionRouting(setup: Awaited<ReturnType<typeof buildWithUserSkill>>) {
  const compilation = await environmentCompilation({
    paths: setup.paths,
    cwd: setup.home,
    scope: "global",
    originDirectory: null,
    repositoryName: null,
  });
  const delivery = await materializeSkillDelivery({
    paths: setup.paths,
    repositoryDirectory: setup.home,
    destination: await mkdtemp(path.join(os.tmpdir(), "shadowclone-delivery-")),
    includeLibrary: false,
  });

  return { startContext: compilation?.markdown ?? "", delivery: delivery ?? "" };
}

test("a build skill with no copy left is not routed, sync names it, and the build keeps it", async () => {
  const setup = await buildWithUserSkill();

  expect((await syncReporting(setup)).routing).toContain("careful-review");

  await deleteEveryCopy(setup);

  const report = await syncReporting(setup);
  const session = await sessionRouting(setup);
  const state = await readEnvironment(setup.paths);

  expect(report.missing).toEqual([{ name: "careful-review", filePaths: setup.copies }]);
  expect(report.skipped).toEqual([]);
  expect(report.routing).not.toContain("careful-review");
  expect(report.routing).toContain(": verify-and-review");
  expect(session.startContext).toContain(": verify-and-review");
  expect(session.startContext).not.toContain("careful-review");
  expect(session.delivery).not.toContain("careful-review");
  expect(state?.builds.find(({ id }) => id === "global")?.choices[setup.entryId]).toBeTrue();
});

test("a restored copy is routed again on the next sync", async () => {
  const setup = await buildWithUserSkill();

  await deleteEveryCopy(setup);
  await syncReporting(setup);
  await Bun.write(setup.skillFile, skillText);

  const report = await syncReporting(setup);

  expect(report.missing).toEqual([]);
  expect(report.routing).toContain("careful-review");
});

test("a removed skill whose kept copy is later deleted is not reported as selected", async () => {
  const setup = await buildWithUserSkill();
  const [, editedCopy] = setup.copies;

  if (!editedCopy) throw new Error("The build wrote no second copy");

  await Bun.write(editedCopy, `${skillText}\nMy own step.\n`);

  const input = buildInput({ choices: { "verify-and-review": true, [setup.entryId]: false } });

  await applyBuild({ ...setup, plan: await previewBuild({ ...setup, input }) });
  await rm(path.dirname(editedCopy), { recursive: true });

  const report = await syncReporting(setup);
  const state = await readEnvironment(setup.paths);

  expect(state?.artifacts.some(({ filePath }) => filePath === editedCopy)).toBeTrue();
  expect(report.missing).toEqual([]);
  expect(report.routing).not.toContain("careful-review");
});

test("removing a deleted user skill from the build does not write it back", async () => {
  const setup = await buildWithUserSkill();

  await deleteEveryCopy(setup);

  const input = buildInput({ choices: { "verify-and-review": true, [setup.entryId]: false } });

  await applyBuild({ ...setup, plan: await previewBuild({ ...setup, input }) });

  const state = await readEnvironment(setup.paths);

  expect(await Bun.file(setup.skillFile).exists()).toBeFalse();
  expect(state?.artifacts.some(({ name }) => name === "careful-review")).toBeFalse();
});
