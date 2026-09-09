import { expect, test } from "bun:test";
import path from "node:path";
import { loadSeedLibrary } from "../skills";
import { renderSeedLibrary } from "./skills";

test("lists every preference and Agent Skill exactly once", async () => {
  const packageRoot = path.resolve(import.meta.dir, "../..");
  const library = await loadSeedLibrary({
    preferencesDirectory: path.join(packageRoot, "preferences"),
    skillsDirectory: path.join(packageRoot, "skills"),
  });
  const lines = renderSeedLibrary(library);

  expect(lines[0]).toBe("Profile preference axes");
  expect(lines).toContain("Skill axes");
  expect(lines).toContain("Optional skills");
  for (const entry of library.guidance) {
    expect(
      lines.filter((line) => line.endsWith(`${entry.id}: ${entry.title}`)),
    ).toHaveLength(1);
  }
});
