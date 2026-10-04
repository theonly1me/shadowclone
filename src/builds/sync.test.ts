import { expect, test } from "bun:test";
import { cp, mkdtemp, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import { publishEnvironmentRevision } from "../environment/revision";
import { readEnvironment } from "../environment/store";
import { syncLearningEnvironment } from "../environment/sync";
import { seedSkillsDirectory } from "../skills/library";
import { applyBuild } from "./apply";
import { buildFixture, buildInput } from "./fixtures";
import { previewBuild } from "./plan";
import { renderBuildSkillSync, syncBuildSkills } from "./sync";
import type { BuildInput } from "./types";

const roots = [".agents/skills", ".claude/skills", ".gemini/config/skills"];
const addedLine = "\nRun the command the user runs and read every output line.\n";

async function installedBuild(input: Partial<BuildInput> = {}) {
  const context = await buildFixture();

  await writeConfig({
    config: { ...defaultConfig, sources: { ...defaultConfig.sources, "skill-library": true } },
    configPath: context.paths.configFile,
  });
  await applyBuild({
    ...context,
    plan: await previewBuild({
      ...context,
      input: buildInput({ choices: { "verify-and-review": true }, ...input }),
    }),
  });

  const state = await readEnvironment(context.paths);

  if (state === null) {
    throw new Error("The build did not record an environment.");
  }

  return { ...context, state, home: path.dirname(context.paths.shadowcloneDirectory) };
}

async function newerPackage(): Promise<string> {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-package-")));
  const skill = path.join(directory, "verify-and-review/SKILL.md");

  await cp(await seedSkillsDirectory(), directory, { recursive: true });
  await Bun.write(skill, (await Bun.file(skill).text()) + addedLine);

  return directory;
}

function copyPath(options: { readonly home: string; readonly root: string }): string {
  return path.join(options.home, options.root, "verify-and-review/SKILL.md");
}

test("an unedited installed skill takes the newer bundled version in every copy", async () => {
  const setup = await installedBuild();
  const synced = await syncBuildSkills({
    state: setup.state,
    packagedSkillsDirectory: await newerPackage(),
  });

  await publishEnvironmentRevision({
    paths: setup.paths,
    updates: synced.updates,
    state: synced.state,
  });

  for (const root of roots) {
    expect(await Bun.file(copyPath({ home: setup.home, root })).text()).toEndWith(addedLine);
  }

  expect(synced.updated).toEqual([{ name: "verify-and-review", copies: 3 }]);
  expect(synced.kept).toEqual([]);
  expect(renderBuildSkillSync(synced)).toEqual([
    "Updated verify-and-review to the bundled version (3 copies).",
  ]);
});

test("an edited copy is kept, named, and left out of the update", async () => {
  const setup = await installedBuild();
  const edited = copyPath({ home: setup.home, root: ".claude/skills" });

  await Bun.write(edited, `${await Bun.file(edited).text()}\nMy own rule.\n`);

  const synced = await syncBuildSkills({
    state: setup.state,
    packagedSkillsDirectory: await newerPackage(),
  });

  expect(synced.updates).toEqual([]);
  expect(synced.updated).toEqual([]);
  expect(renderBuildSkillSync(synced)).toEqual([
    `Kept your edited copy of verify-and-review at ${edited}. Review it in shadowclone wizard.`,
  ]);
});

test("a skill edited in the build editor is not replaced by the bundled version", async () => {
  const base = await Bun.file(
    path.join(await seedSkillsDirectory(), "verify-and-review/SKILL.md"),
  ).text();
  const setup = await installedBuild({
    edits: { "verify-and-review": `${base}\nBuild editor rule.\n` },
  });
  const synced = await syncBuildSkills({
    state: setup.state,
    packagedSkillsDirectory: await newerPackage(),
  });

  expect(synced.updates).toEqual([]);
  expect(synced.updated).toEqual([]);
  expect(synced.kept).toEqual([]);
});

test("sync reports an edited copy of an equipped skill instead of failing", async () => {
  const setup = await installedBuild();
  const edited = copyPath({ home: setup.home, root: ".claude/skills" });

  await Bun.write(edited, `${await Bun.file(edited).text()}\nMy own rule.\n`);

  const report = await syncLearningEnvironment(setup.paths);

  expect(report?.kept).toEqual([{ name: "verify-and-review", filePath: edited }]);
  expect(
    await Bun.file(copyPath({ home: setup.home, root: ".agents/skills" })).text(),
  ).not.toContain("My own rule.");
});
