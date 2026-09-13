import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEvaluationProfile } from "./profile";

const repository = {
  id: "example.com/team/repository",
  name: "repository",
  profileFileName: "repository--1234567890abcdef",
  origin: {
    id: "example.com/team",
    directoryName: "example.com--team",
    promotable: true,
  },
};

test("an unrelated profile is absent from the frozen profile", async () => {
  const profileDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-profile-scope-"),
  );
  const globalDirectory = path.join(profileDirectory, "global");
  const unrelatedDirectory = path.join(
    profileDirectory,
    "org",
    "unrelated--owner",
  );
  const includedPath = path.join(globalDirectory, "engineering.md");
  const unrelatedPath = path.join(unrelatedDirectory, "engineering.md");
  await Promise.all([
    mkdir(globalDirectory, { recursive: true }),
    mkdir(unrelatedDirectory, { recursive: true }),
  ]);
  await Promise.all([
    Bun.write(includedPath, "## Naming\n\nUse complete variable names.\n"),
    Bun.write(unrelatedPath, "## Other\n\nUnrelated guidance.\n"),
  ]);
  const profile = await loadEvaluationProfile({
    profileDirectory,
    repository,
  });

  expect(profile.markdown).toContain("Use complete variable names");
  expect(profile.markdown).not.toContain("Unrelated guidance");
});
