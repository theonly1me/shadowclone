import { expect, test } from "bun:test";
import path from "node:path";
import { loadSeedSkillLibrary } from "../skills";
import { renderSeedSkillLibrary } from "./skills";

test("lists every seed skill exactly once", async () => {
  const library = await loadSeedSkillLibrary({
    directory: path.resolve(import.meta.dir, "../../skills"),
  });
  const lines = renderSeedSkillLibrary(library);

  expect(lines[0]).toBe("Skill axes");
  expect(lines).toContain("Disciplines");
  for (const skill of library.skills) {
    expect(
      lines.filter((line) => line.endsWith(`${skill.id}: ${skill.title}`)),
    ).toHaveLength(1);
  }
});
