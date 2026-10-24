import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { environmentCompilation } from "./context";
import { materializeSkillDelivery } from "./delivery";
import { readEnvironment } from "./store";
import { syncLearningEnvironment } from "./sync";
import { catalogFixture, description, taskBody, universalBody } from "./taskCatalog.fixtures";

test("startup keeps universal rules and requires a task catalog without injecting unrelated task rules", async () => {
  const setup = await catalogFixture();
  try {
    await syncLearningEnvironment(setup.paths);
    const context = await environmentCompilation({
      paths: setup.paths,
      cwd: setup.cwd,
      scope: "global",
      originDirectory: null,
      repositoryName: null,
    });
    expect(context?.markdown).toContain(universalBody);
    expect(context?.markdown).toContain(setup.catalogPath);
    expect(context?.markdown).not.toContain(description);
    expect(context?.markdown).not.toContain(taskBody);
    const catalog = await Bun.file(setup.catalogPath).text();
    expect(catalog).toContain(description);
    expect(catalog).toContain(setup.filePath);
    expect(
      (await readEnvironment(setup.paths))?.artifacts.some(
        (artifact) => artifact.filePath === setup.catalogPath,
      ),
    ).toBe(true);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("isolated delivery points to a catalog and skill copies inside its own snapshot", async () => {
  const setup = await catalogFixture();
  try {
    const destination = path.join(setup.home, "isolated");
    const catalogPath = path.join(destination, ".shadowclone-skills/catalog.md");
    const routing = await materializeSkillDelivery({
      paths: setup.paths,
      repositoryDirectory: setup.cwd,
      destination,
      includeLibrary: false,
    });
    expect(routing).toContain(catalogPath);
    expect(routing).not.toContain(description);
    expect(routing).not.toContain(setup.filePath);
    const catalog = await Bun.file(catalogPath).text();
    expect(catalog).toContain(description);
    expect(catalog).toContain(
      path.join(destination, ".shadowclone-skills/0/typed-changes/SKILL.md"),
    );
    expect(catalog).not.toContain(setup.filePath);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("isolated delivery does not reference unavailable skills when none are selected", async () => {
  const setup = await catalogFixture();
  try {
    const routing = await materializeSkillDelivery({
      paths: setup.paths,
      repositoryDirectory: setup.cwd,
      destination: path.join(setup.home, "empty"),
      includeLibrary: false,
      selectedNames: [],
    });
    expect(routing).toContain(universalBody);
    expect(routing).not.toContain("catalog.md");
    expect(routing).not.toContain(taskBody);
    expect(routing).not.toContain(setup.filePath);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
