import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import {
  registerPortableSkill,
  skillTreeFingerprint,
  syncPortableSkills,
} from "./portable";

async function portableFixture() {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-portable-"));
  const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
  const sourceDirectory = path.join(home, "seed/portable-workflow");
  await mkdir(path.join(sourceDirectory, "references"), { recursive: true });
  await Bun.write(
    path.join(sourceDirectory, "SKILL.md"),
    "---\nname: portable-workflow\ndescription: Keep a workflow consistent across coding agents.\n---\n\n# Portable workflow\n\nRead [the checklist](references/checklist.md).\n",
  );
  await Bun.write(
    path.join(sourceDirectory, "references/checklist.md"),
    "Verify the requested behavior.\n",
  );
  const destinations = [
    path.join(home, ".agents/skills/portable-workflow"),
    path.join(home, ".claude/skills/portable-workflow"),
    path.join(home, ".codex/skills/portable-workflow"),
    path.join(home, ".cursor/skills/portable-workflow"),
    path.join(home, ".gemini/config/skills/portable-workflow"),
  ];
  await registerPortableSkill({
    paths,
    name: "portable-workflow",
    sourceDirectory,
    managedBy: "adopted",
  });
  return { home, paths, destinations };
}

test("copies a complete portable skill and promotes one edited replica", async () => {
  const setup = await portableFixture();
  const initialFingerprints = await Promise.all(
    setup.destinations.map(skillTreeFingerprint),
  );
  expect(new Set(initialFingerprints).size).toBe(1);
  for (const destination of setup.destinations) {
    expect(
      await Bun.file(path.join(destination, "references/checklist.md")).text(),
    ).toBe("Verify the requested behavior.\n");
  }

  const claudeSkill = path.join(setup.destinations[1] ?? "", "SKILL.md");
  await Bun.write(claudeSkill, `${await Bun.file(claudeSkill).text()}\nClaude edit\n`);
  expect(await syncPortableSkills({ paths: setup.paths })).toEqual({
    synced: 4,
    conflicts: 0,
  });
  for (const destination of setup.destinations) {
    expect(await Bun.file(path.join(destination, "SKILL.md")).text()).toContain(
      "Claude edit",
    );
  }
});

test("preserves divergent portable skill edits as a conflict", async () => {
  const setup = await portableFixture();
  const canonicalSkill = path.join(setup.destinations[0] ?? "", "SKILL.md");
  const claudeSkill = path.join(setup.destinations[1] ?? "", "SKILL.md");
  const cursorSkill = path.join(setup.destinations[3] ?? "", "SKILL.md");
  const original = await Bun.file(canonicalSkill).text();
  await Bun.write(claudeSkill, `${original}\nClaude edit\n`);
  await Bun.write(cursorSkill, `${original}\nCursor edit\n`);

  expect(await syncPortableSkills({ paths: setup.paths })).toEqual({
    synced: 0,
    conflicts: 1,
  });
  expect(await Bun.file(canonicalSkill).text()).toBe(original);
  expect(await Bun.file(claudeSkill).text()).toContain("Claude edit");
  expect(await Bun.file(cursorSkill).text()).toContain("Cursor edit");
});
