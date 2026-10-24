import { expect, test } from "bun:test";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { environmentCompilation } from "./context";
import { syncLearningEnvironment } from "./sync";
import { repositoryCatalogFixture } from "./taskCatalog.repository.fixtures";

test("repository catalogs and startup references remain usable after the repository moves", async () => {
  const setup = await repositoryCatalogFixture();
  try {
    expect(Bun.spawnSync(["git", "init", setup.cwd]).exitCode).toBe(0);
    expect(
      Bun.spawnSync([
        "git",
        "-C",
        setup.cwd,
        "config",
        "remote.origin.url",
        "https://github.com/synthetic/catalogs.git",
      ]).exitCode,
    ).toBe(0);
    await syncLearningEnvironment(setup.paths);
    const catalog = await Bun.file(setup.repositoryCatalog).text();
    expect(catalog).toContain("Read: `.agents/skills/repository-types/SKILL.md`.");
    expect(catalog).not.toContain(setup.home);
    const context = await environmentCompilation({
      paths: setup.paths,
      cwd: path.join(setup.cwd, "src"),
      scope: "scoped",
      ...setup.repository,
    });
    expect(context?.markdown).toContain(
      "read .agents/skills/shadowclone-guidance/catalog.md from the repository root",
    );
    expect(context?.markdown).not.toContain(setup.home);
    const moved = path.join(setup.home, "another-checkout");
    await cp(setup.cwd, moved, { recursive: true });
    await rm(setup.cwd, { recursive: true });
    const references = [...catalog.matchAll(/Read: `([^`]+)`/g)].flatMap((match) =>
      match[1] ? [match[1]] : [],
    );
    expect(references).toEqual([".agents/skills/repository-types/SKILL.md"]);
    const [reference] = references;
    if (!reference) throw new Error("Expected a repository skill reference");
    expect(await Bun.file(path.join(moved, reference)).text()).toContain(
      "Check repository exports.",
    );
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("private catalogs keep absolute skill and catalog references outside the repository", async () => {
  const setup = await repositoryCatalogFixture({ privateDelivery: true });
  try {
    expect(Bun.spawnSync(["git", "init", setup.cwd]).exitCode).toBe(0);
    expect(
      Bun.spawnSync([
        "git",
        "-C",
        setup.cwd,
        "config",
        "remote.origin.url",
        "https://github.com/synthetic/catalogs.git",
      ]).exitCode,
    ).toBe(0);
    await syncLearningEnvironment(setup.paths);
    expect(await Bun.file(setup.repositoryCatalog).text()).toContain(
      `Read: \`${setup.repositorySkill}\`.`,
    );
    const context = await environmentCompilation({
      paths: setup.paths,
      cwd: setup.cwd,
      scope: "scoped",
      ...setup.repository,
    });
    expect(context?.markdown).toContain(`read ${setup.repositoryCatalog}`);
    expect(
      await Bun.file(
        path.join(setup.cwd, ".agents/skills/shadowclone-guidance/catalog.md"),
      ).exists(),
    ).toBe(false);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
