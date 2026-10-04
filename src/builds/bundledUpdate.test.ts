import { expect, test } from "bun:test";
import path from "node:path";
import { environmentFile, renderEnvironment } from "../environment/store";
import { syncLearningEnvironment } from "../environment/sync";
import { fingerprint } from "../localFiles";
import { seedSkillsDirectory } from "../skills/library";
import { updateBundledSkills } from "./bundledUpdate";
import { copyPath, installedBuild, skillRoots } from "./syncFixtures";

const olderRelease = path.join(import.meta.dir, "../skills/fixtures/verify-and-review-0.0.16.md");

async function installedFromOlderRelease() {
  const setup = await installedBuild();
  const older = await Bun.file(olderRelease).text();

  for (const root of skillRoots) {
    await Bun.write(copyPath({ home: setup.home, root }), older);
  }

  await Bun.write(
    environmentFile(setup.paths),
    renderEnvironment({
      ...setup.state,
      artifacts: setup.state.artifacts.map((artifact) =>
        artifact.buildEntryId === "verify-and-review" && artifact.kind === "skill"
          ? { ...artifact, fingerprint: fingerprint(older) }
          : artifact,
      ),
    }),
  );

  return { ...setup, older };
}

test("skill maintenance leaves an older bundled copy alone, and sync updates it", async () => {
  const setup = await installedFromOlderRelease();
  const bundled = await Bun.file(
    path.join(await seedSkillsDirectory(), "verify-and-review/SKILL.md"),
  ).text();

  expect(await syncLearningEnvironment(setup.paths)).toBeTrue();

  for (const root of skillRoots) {
    expect(await Bun.file(copyPath({ home: setup.home, root })).text()).toBe(setup.older);
  }

  expect(await updateBundledSkills(setup.paths)).toEqual({
    updated: [{ name: "verify-and-review", copies: 3 }],
    kept: [],
  });

  for (const root of skillRoots) {
    expect(await Bun.file(copyPath({ home: setup.home, root })).text()).toBe(bundled);
  }
});

test("sync reports an edited copy of an equipped skill instead of failing", async () => {
  const setup = await installedBuild();
  const edited = copyPath({ home: setup.home, root: ".claude/skills" });

  await Bun.write(edited, `${await Bun.file(edited).text()}\nMy own rule.\n`);

  expect((await updateBundledSkills(setup.paths))?.kept).toEqual([
    { name: "verify-and-review", filePath: edited },
  ]);
  expect(await syncLearningEnvironment(setup.paths)).toBeTrue();
  expect(
    await Bun.file(copyPath({ home: setup.home, root: ".agents/skills" })).text(),
  ).not.toContain("My own rule.");
});
