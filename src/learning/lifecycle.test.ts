import { expect, test } from "bun:test";
import { readPendingLearning, updatePendingLearning } from "./pending";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { undoRevision } from "../changes";
import { defaultConfig, writeConfig } from "../config";
import { learningRecord } from "../environment/fixtures";
import { environmentFile, readEnvironment, writeEnvironment } from "../environment/store";
import { emptyEnvironment } from "../environment/types";
import { createProjectPaths } from "../paths";
import { normalizeRemoteRepository } from "../signal";
import { applyPreferencePreview, previewPreferenceEdit, previewSourceRemoval } from "./lifecycle";

async function fixture() {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-preference-edit-"));
  const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
  const record = learningRecord();
  const repository = normalizeRemoteRepository("git@github.com:acme/palette.git");
  if (!repository?.profileFileName) throw new Error("Expected a synthetic repository identity");
  await writeConfig({
    configPath: paths.configFile,
    config: { ...defaultConfig, sources: { ...defaultConfig.sources, "git-metadata": true } },
  });
  await writeEnvironment({
    paths,
    state: {
      ...emptyEnvironment,
      records: [record],
      repositories: [{
        directory: path.join(home, "repository"),
        originDirectory: repository.origin.directoryName,
        repositoryName: repository.profileFileName,
      }],
    },
  });
  return { paths, record, home };
}

test("replacement previews write nothing, reject stale state, and can be undone", async () => {
  const { paths, record } = await fixture();
  const before = await Bun.file(environmentFile(paths)).text();
  const preview = await previewPreferenceEdit({
    paths, edit: { kind: "replace", key: record.rule.key, text: "Validate palette labels before saving." },
  });
  expect(await Bun.file(environmentFile(paths)).text()).toBe(before);
  const result = await applyPreferencePreview({ paths, preview });
  expect((await readEnvironment(paths))?.records[0]?.rule.body).toBe("Validate palette labels before saving.");
  await expect(applyPreferencePreview({ paths, preview })).rejects.toThrow("changed since preview");
  if (!result.revision) throw new Error("Expected a preference decision revision");
  await undoRevision({ paths, id: result.revision });
  expect(await Bun.file(environmentFile(paths)).text()).toBe(before);
});

test("narrowing retires the old global rule and keeps a distinct repository rule", async () => {
  const { paths, record, home } = await fixture();
  const preview = await previewPreferenceEdit({
    paths, edit: { kind: "narrow", key: record.rule.key }, cwd: path.join(home, "repository"),
    readRemote: async () => "git@github.com:acme/palette.git",
  });
  expect(preview.changes).toHaveLength(2);
  const narrowed = preview.changes[1]?.after;
  expect(narrowed?.rule.scope).toBe("project");
  expect(narrowed?.rule.key).not.toBe(record.rule.key);
  await applyPreferencePreview({ paths, preview });
  const state = await readEnvironment(paths);
  expect(state?.records.find(({ rule }) => rule.key === record.rule.key)?.retirementRequested).toBeTrue();
  expect(state?.rejected).toContain(record.rule.key);
  expect(state?.records.find(({ rule }) => rule.key === narrowed?.rule.key)?.rule.body).toBe(record.rule.body);
});

test("source-removal previews retain mixed and unresolved evidence for explicit review", async () => {
  const { paths, record } = await fixture();
  await writeEnvironment({
    paths,
    state: {
      ...emptyEnvironment,
      records: [
        { ...record, captureSources: ["codex"], provenanceComplete: true },
        { ...learningRecord({ key: "mixed" }), captureSources: ["codex", "claude-code"], provenanceComplete: true },
        { ...learningRecord({ key: "unresolved" }), rule: { ...record.rule, key: "unresolved", source: "mined" } },
      ],
    },
  });
  const preview = await previewSourceRemoval({ paths, source: "codex" });
  expect(preview.preview.changes.map(({ after }) => after.rule.key)).toEqual([record.rule.key]);
  expect(preview.mixed).toEqual(["mixed"]);
  expect(preview.unresolved).toEqual(["unresolved"]);
  await applyPreferencePreview({ paths, preview: preview.preview });
  expect((await readEnvironment(paths))?.records.filter(({ retirementRequested }) => retirementRequested)).toHaveLength(1);
});

test("source removal and undo restore both preference state and pending decisions", async () => {
  const { paths, record } = await fixture();
  await writeEnvironment({ paths, state: { ...emptyEnvironment,
    records: [{ ...record, captureSources: ["codex"], provenanceComplete: true }],
  } });
  const pendingRule = { ...record.rule, key: "pending-synthetic" };
  await updatePendingLearning({ paths, update: (state) => ({
    ...state, rules: [pendingRule], provenance: { [pendingRule.key]: { sources: ["codex"], complete: true } },
  }) });
  const before = await readPendingLearning(paths);
  const preview = await previewSourceRemoval({ paths, source: "codex" });
  const result = await applyPreferencePreview({ paths, preview: preview.preview });
  expect((await readPendingLearning(paths)).rules).toEqual([]);
  expect((await readPendingLearning(paths)).rejectedKeys).toContain(pendingRule.key);
  expect((await readEnvironment(paths))?.records[0]?.retirementRequested).toBeTrue();
  if (!result.revision) throw new Error("Expected a source-removal revision");
  await undoRevision({ paths, id: result.revision });
  expect(await readPendingLearning(paths)).toEqual(before);
  expect((await readEnvironment(paths))?.records[0]?.retirementRequested).toBeUndefined();
});

test("the CLI keeps the complete replacement text in a preview", async () => {
  const { home, record } = await fixture();
  const process_ = Bun.spawn([process.execPath, "src/cli/index.ts", "learning", "replace", record.rule.key,
    "Use complete words for palette labels."], {
    cwd: path.resolve(import.meta.dir, "../.."),
    env: { ...process.env, HOME: home }, stdout: "pipe", stderr: "pipe",
  });
  const [output, error, exitCode] = await Promise.all([
    new Response(process_.stdout).text(), new Response(process_.stderr).text(), process_.exited,
  ]);
  expect(error).toBe("");
  expect(exitCode).toBe(0);
  expect(output).toContain("Use complete words for palette labels.");
  expect(output).toContain("Preview only");
});
