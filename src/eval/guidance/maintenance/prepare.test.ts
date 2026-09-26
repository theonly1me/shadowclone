import { expect, test } from "bun:test";
import path from "node:path";
import { undoRevision } from "../../../changes";
import { readScopedReferences } from "../../../references";
import { fingerprint } from "../../transfer/structured";
import { readGuidanceSuite } from "../store";
import { correctedPath, incorrectPath, referencePath, validateMaintenanceDelta } from "./change";
import { maintenanceFixture } from "./fixtures";
import { prepareMaintenanceSuite } from "./prepare";

test("maintenance changes one scoped reference with provenance, is idempotent, and supports undo", async () => {
  const fixture = await maintenanceFixture();
  try {
    const prepared = fixture.prepared;
    if (!prepared) throw new Error("Preparation missing");
    const suite = await readGuidanceSuite({ paths: fixture.paths, suiteId: prepared.suiteId });
    expect(suite.context).toEqual(fixture.parent.suite.context);
    expect(suite.memory).toEqual(fixture.parent.suite.memory);
    expect(suite.profile).toBe(fixture.parent.suite.profile);
    expect(suite.bootstrap).toBe(fixture.parent.suite.bootstrap);
    expect(suite.references.filter((file) => file.relativePath !== referencePath)).toEqual(fixture.parent.suite.references.filter((file) => file.relativePath !== referencePath));
    expect(suite.references.find((file) => file.relativePath === referencePath)?.content).toContain(correctedPath);
    expect(prepared.manifest.delta.verifiedCommit).toBe(suite.baseCommit);
    expect(await prepareMaintenanceSuite({ paths: fixture.paths, parentEvalId: fixture.parent.evalId })).toEqual(prepared);
    const recalled = await readScopedReferences({ profileDirectory: fixture.paths.profileDirectory, origin: null, targetRepo: null });
    expect(recalled[0]?.record.body).toContain(correctedPath);
    expect(recalled[0]?.record.source).toBe("claude-memory");
    await undoRevision({ paths: fixture.paths, id: prepared.manifest.delta.revisionId });
    expect(await Bun.file(fixture.referenceFile).text()).toBe(fixture.referenceContent);
    await expect(prepareMaintenanceSuite({ paths: fixture.paths, parentEvalId: fixture.parent.evalId })).rejects.toThrow("changed after maintenance");
  } finally { await fixture.cleanup(); }
}, 30000);

test("maintenance preserves concurrent edits and rejects unapproved suite changes", async () => {
  const fixture = await maintenanceFixture({ prepare: false });
  try {
    const changed = `${fixture.referenceContent}\nUser-owned later edit.\n`;
    await Bun.write(fixture.referenceFile, changed);
    await expect(prepareMaintenanceSuite({ paths: fixture.paths, parentEvalId: fixture.parent.evalId })).rejects.toThrow("fingerprint mismatch");
    expect(await Bun.file(fixture.referenceFile).text()).toBe(changed);
    await Bun.write(fixture.referenceFile, fixture.referenceContent);
    const prepared = await prepareMaintenanceSuite({ paths: fixture.paths, parentEvalId: fixture.parent.evalId });
    const suite = await readGuidanceSuite({ paths: fixture.paths, suiteId: prepared.suiteId });
    for (const changedSuite of [
      { ...suite, profile: `${suite.profile}\nNew rule` },
      { ...suite, memory: suite.memory.map((file) => ({ ...file, content: file.content.replace(incorrectPath, correctedPath) })) },
      { ...suite, context: [] }, { ...suite, bootstrap: "New bootstrap" }, { ...suite, baseCommit: "another-commit" },
      { ...suite, scenarios: suite.scenarios.map((scenario) => ({ ...scenario, prompt: "Changed task" })) },
    ]) expect(() => validateMaintenanceDelta({ parent: fixture.parent.suite, suite: changedSuite, manifest: { ...prepared.manifest, suiteFingerprint: fingerprint(changedSuite) } })).toThrow("unapproved source delta");
    expect(() => validateMaintenanceDelta({ parent: fixture.parent.suite, suite, manifest: { ...prepared.manifest, delta: { ...prepared.manifest.delta, relativePath: path.join("references", "global", "other.md") } } })).toThrow("unapproved source delta");
  } finally { await fixture.cleanup(); }
}, 30000);
