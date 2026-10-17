import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "@shadowclone/core";
import { learningRecord } from "./fixtures";
import { readEnvironment, writeEnvironment } from "./store";
import { syncLearningEnvironment } from "./sync";
import { skillFixture } from "./testing";
import { emptyEnvironment } from "./types";

test("sync drops the records of a skill whose rules are all retired, deletes its unchanged copies, and keeps every other file", async () => {
  const setup = await skillFixture();
  const record = learningRecord({ key: "declared:template-first", body: "Read the template before you create the document." });
  const original = "---\nname: docs\ndescription: Write documents that people share.\n---\n\n# Docs\n\nCreate the document first.\n";
  const edited = `${original}\n${record.rule.body}\n`;
  const syncedPath = path.join(setup.home, ".claude/skills/synced/workspace-1/docs/SKILL.md");
  const copyPath = path.join(setup.home, ".agents/skills/docs/SKILL.md");
  const editedCopyPath = path.join(setup.home, ".gemini/config/skills/docs/SKILL.md");
  const artifact = (entry: { readonly filePath: string; readonly original: string | null }) => ({
    ...entry,
    fingerprint: fingerprint(edited),
    kind: "skill" as const,
    scope: "global",
    name: "docs",
    description: "Write documents that people share.",
    learningKeys: [record.rule.key],
  });

  try {
    for (const filePath of [syncedPath, copyPath]) await Bun.write(filePath, edited);
    await Bun.write(editedCopyPath, `${edited}\nA later edit.\n`);
    await writeEnvironment({
      paths: setup.paths,
      state: {
        ...emptyEnvironment,
        phase: "active",
        automatic: true,
        records: [{ ...record, retirementRequested: true }],
        artifacts: [
          artifact({ filePath: syncedPath, original }),
          artifact({ filePath: copyPath, original: null }),
          artifact({ filePath: editedCopyPath, original: null }),
        ],
      },
    });

    expect(await syncLearningEnvironment(setup.paths)).toBeTrue();
    expect(await Bun.file(syncedPath).text()).toBe(edited);
    expect(await Bun.file(copyPath).exists()).toBeFalse();
    expect(await Bun.file(editedCopyPath).text()).toBe(`${edited}\nA later edit.\n`);
    expect((await readEnvironment(setup.paths))?.artifacts.filter(({ name }) => name === "docs")).toEqual([]);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
