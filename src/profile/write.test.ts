import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import { profileRulePath, writeProfile } from "./index";
import type { ProfileRule } from "./index";

function profileRule(observations: number): ProfileRule {
  return {
    key: "rule-one",
    title: "Runs focused checks",
    body: "Run the narrow check before the full suite.",
    section: "workflow",
    scope: "org",
    originDirectory: "github.com--acme",
    observations,
    confidence: 0.8,
    lastSeen: "2026-09-05",
    sessions: 2,
    origins: ["github.com/acme"],
  };
}

test("preserves a hand-edited rule verbatim", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-profile-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  const first = profileRule(2);
  await writeProfile({ paths, rules: [first] });
  const filePath = path.join(paths.profileDirectory, profileRulePath(first));
  const original = await Bun.file(filePath).text();
  const edited = original.replace(
    "Run the narrow check before the full suite.",
    "Run only the checks that prove the requested behavior.",
  );
  await Bun.write(filePath, edited);

  await writeProfile({ paths, rules: [profileRule(9)] });
  const regenerated = await Bun.file(filePath).text();

  expect(regenerated).toBe(edited);
  expect(regenerated).toContain("observations=2");
});

test("preserves a rule the user added without generated metadata", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-profile-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  const rule = profileRule(2);
  await writeProfile({ paths, rules: [rule] });
  const filePath = path.join(paths.profileDirectory, profileRulePath(rule));
  const manual = "## Keep reviews short\n\nWrite the result first.";
  await Bun.write(filePath, `${await Bun.file(filePath).text()}\n${manual}\n`);

  await writeProfile({ paths, rules: [profileRule(3)] });

  expect(await Bun.file(filePath).text()).toContain(manual);
});

test("records a deleted rule and does not propose it again", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-profile-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  const rule = profileRule(2);
  await writeProfile({ paths, rules: [rule] });
  const filePath = path.join(paths.profileDirectory, profileRulePath(rule));
  await rm(filePath);

  await writeProfile({ paths, rules: [profileRule(3)] });

  expect(await Bun.file(filePath).exists()).toBeFalse();
  expect(await Bun.file(paths.rejectedProfileFile).text()).toContain(
    "rule-one",
  );
});
