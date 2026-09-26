import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { undoRevision } from "../../changes";
import { createProjectPaths } from "../../paths";
import { originDirectoryName } from "../../signal/origin/remote";
import {
  parseProfileRules,
  readGeneratedProfileState,
  renderProfileRule,
} from "../index";
import type { ProfileRule } from "../index";
import { applyProfileRepair, createProfileRepairPlan } from "./index";

const legacy = "github.com--acme";
const canonical = originDirectoryName("github.com/acme");

function rule(options: {
  readonly key: string;
  readonly title: string;
  readonly originDirectory: string;
}): ProfileRule {
  return {
    key: options.key,
    title: options.title,
    body: `Apply ${options.title}.`,
    section: "engineering",
    scope: "org",
    originDirectory: options.originDirectory,
    repositoryName: null,
    source: "mined",
    status: "active",
    proposal: null,
    appliesWhen: [],
    evidence: { for: [], against: [] },
    observations: 1,
    lastSeen: "2026-09-18",
    sessions: 1,
    origins: ["github.com/acme"],
    importReference: null,
  };
}

async function fixture() {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-repair-"));
  const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
  const source = path.join(paths.profileDirectory, "org", legacy, "engineering.md");
  const target = path.join(paths.profileDirectory, "org", canonical, "engineering.md");
  await mkdir(path.dirname(source), { recursive: true });
  await mkdir(path.dirname(target), { recursive: true });
  return { paths, source, target };
}

test("repair merges distinct keys and undo restores both locations", async () => {
  const setup = await fixture();
  await Bun.write(setup.source, renderProfileRule(rule({
    key: "source",
    title: "Source rule",
    originDirectory: legacy,
  })));
  const originalTarget = `${renderProfileRule(rule({
    key: "target",
    title: "Target rule",
    originDirectory: canonical,
  }))}\n`;
  await Bun.write(setup.target, originalTarget);
  await Bun.write(
    setup.paths.profileManifestFile,
    `${JSON.stringify({
      schema: 1,
      relativePath: `org/${legacy}/engineering.md`,
      key: "source",
      title: "Source rule",
      body: `Keep org/${legacy}/example unchanged.`,
      source: "mined",
      importReference: null,
      disposition: "present",
    })}\n`,
  );
  const plan = await createProfileRepairPlan(setup.paths);
  expect(plan.repairs).toEqual([{
    sourceDirectory: legacy,
    targetDirectory: canonical,
    files: 1,
  }]);
  const applied = await applyProfileRepair({ paths: setup.paths, plan });
  expect(applied.revisionId).not.toBeNull();
  expect(await Bun.file(setup.source).exists()).toBeFalse();
  expect(parseProfileRules(await Bun.file(setup.target).text()).map((entry) => entry.key))
    .toEqual(["target", "source"]);
  expect(await Bun.file(setup.paths.profileManifestFile).text())
    .toContain(`org/${canonical}/engineering.md`);
  expect((await readGeneratedProfileState(setup.paths.profileManifestFile))[0]?.body)
    .toBe(`Keep org/${legacy}/example unchanged.`);
  if (applied.revisionId === null) throw new Error("Repair must create a revision");
  await undoRevision({ paths: setup.paths, id: applied.revisionId });
  expect(await Bun.file(setup.source).exists()).toBeTrue();
  expect(await Bun.file(setup.target).text()).toBe(originalTarget);
});

test("repair deduplicates identical keys and blocks conflicting content", async () => {
  const dedupe = await fixture();
  const shared = rule({ key: "same", title: "Same", originDirectory: canonical });
  await Bun.write(dedupe.source, renderProfileRule(rule({
    key: "same",
    title: "Same",
    originDirectory: legacy,
  })));
  await Bun.write(dedupe.target, renderProfileRule(shared));
  const dedupePlan = await createProfileRepairPlan(dedupe.paths);
  expect(dedupePlan.blocked).toEqual([]);
  await applyProfileRepair({ paths: dedupe.paths, plan: dedupePlan });
  expect(parseProfileRules(await Bun.file(dedupe.target).text())).toHaveLength(1);

  const conflict = await fixture();
  await Bun.write(conflict.source, renderProfileRule(rule({
    key: "same",
    title: "Source",
    originDirectory: legacy,
  })));
  await Bun.write(conflict.target, renderProfileRule(rule({
    key: "same",
    title: "Target",
    originDirectory: canonical,
  })));
  const conflictPlan = await createProfileRepairPlan(conflict.paths);
  expect(conflictPlan.blocked[0]?.reason).toBe("conflicting-rule");
  expect(conflictPlan.updates).toEqual([]);
});

test("repair blocks manual guidance even when the target is empty", async () => {
  const setup = await fixture();
  await Bun.write(
    setup.source,
    "## Manual rule\n\nKeep this user-authored guidance in place.\n",
  );

  const plan = await createProfileRepairPlan(setup.paths);

  expect(plan.blocked[0]?.reason).toBe("edited-block");
  expect(plan.updates).toEqual([]);
});
