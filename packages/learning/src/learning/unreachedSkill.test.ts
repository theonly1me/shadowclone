import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createLearningExecution } from "@shadowclone/agents";
import { fingerprint } from "@shadowclone/core";
import { emptyEnvironment, readEnvironment, recordFingerprint, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillEngineRun, skillFixture } from "@shadowclone/environment/testing";
import { applyPreferencePreview, previewPreferenceEdit } from "./lifecycle";

const original = "---\nname: docs\ndescription: Write documents that people share.\n---\n\n# Docs\n\nCreate the document first.\n";

async function retireRuleInSyncedSkill(options: { readonly laterEdit: string }) {
  const setup = await skillFixture();
  const record = learningRecord({ key: "declared:template-first", body: "Read the template before you create the document." });
  const syncedPath = path.join(setup.home, ".claude/skills/synced/workspace-1/docs/SKILL.md");
  const edited = `${original}\n${record.rule.body}\n`;
  const copyPaths = [".agents/skills", ".claude/skills", ".gemini/config/skills"].map((folder) => path.join(setup.home, folder, "docs/SKILL.md"));
  const artifact = (entry: { readonly filePath: string; readonly original: string | null }) => ({
    ...entry,
    fingerprint: fingerprint(edited),
    kind: "skill" as const,
    scope: "global",
    name: "docs",
    description: "Write documents that people share.",
    learningKeys: [record.rule.key],
  });
  const execution = createLearningExecution({
    engine: "claude-code",
    limits: { maximumCalls: 10, maximumCostUsd: 2, timeoutMilliseconds: 60_000 },
    runner: async (run) => run.prompt.includes("Organize durable")
      ? skillEngineRun({ routes: [{ key: record.rule.key, destination: "skill", skillId: "", name: "docs", description: "Use when writing documents.", reason: "Scoped workflow" }] })
      : skillEngineRun({
        outcomes: [{ key: record.rule.key, disposition: "retire", reason: "Retired" }],
        description: "",
        edits: [{ before: `\n${record.rule.body}`, after: "", keys: [record.rule.key] }],
        body: "",
      }),
  });

  for (const filePath of copyPaths) await Bun.write(filePath, edited);
  await Bun.write(syncedPath, `${edited}${options.laterEdit}`);
  await writeEnvironment({
    paths: setup.paths,
    state: {
      ...emptyEnvironment,
      phase: "active",
      automatic: true,
      records: [record],
      artifacts: [
        artifact({ filePath: syncedPath, original }),
        ...copyPaths.map((filePath) => artifact({ filePath, original: null })),
      ],
      dispositions: [{
        key: record.rule.key,
        scope: "global",
        inputFingerprint: recordFingerprint(record),
        status: "published",
        reason: "Reconciled into the matching skill",
        destinations: [...copyPaths, syncedPath],
      }],
    },
  });

  const preview = await previewPreferenceEdit({ paths: setup.paths, edit: { kind: "retire", key: record.rule.key } });
  await applyPreferencePreview({ paths: setup.paths, preview, execution });

  return {
    home: setup.home,
    edited,
    syncedText: await Bun.file(syncedPath).text(),
    copies: await Promise.all(copyPaths.map((filePath) => Bun.file(filePath).exists())),
    records: (await readEnvironment(setup.paths))?.artifacts.filter(({ name }) => name === "docs").map(({ filePath }) => filePath.replace(setup.home, "~")),
  };
}

test("retiring a rule restores a skill that shadowclone edited outside the copies that discovery reaches", async () => {
  const result = await retireRuleInSyncedSkill({ laterEdit: "" });

  try {
    expect(result.syncedText).toBe(original);
    expect(result.copies).toEqual([false, false, false]);
    expect(result.records).toEqual([]);
  } finally {
    await rm(result.home, { recursive: true, force: true });
  }
});

test("retiring a rule keeps that skill and its record when the skill changed after shadowclone edited it", async () => {
  const result = await retireRuleInSyncedSkill({ laterEdit: "\nA later edit.\n" });

  try {
    expect(result.syncedText).toBe(`${result.edited}\nA later edit.\n`);
    expect(result.copies).toEqual([false, false, false]);
    expect(result.records).toEqual(["~/.claude/skills/synced/workspace-1/docs/SKILL.md"]);
  } finally {
    await rm(result.home, { recursive: true, force: true });
  }
});
