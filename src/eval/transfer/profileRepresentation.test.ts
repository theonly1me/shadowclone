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

test("evaluation freezes the compiled current profile", async () => {
  const profileDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-current-profile-"),
  );
  const globalDirectory = path.join(profileDirectory, "global");
  const profilePath = path.join(globalDirectory, "engineering.md");
  await mkdir(globalDirectory, { recursive: true });
  await Bun.write(
    profilePath,
    "## Review edits before continuing\n\nPause after an edit and verify its direction.\n",
  );
  const profile = await loadEvaluationProfile({
    profileDirectory,
    repository,
  });

  expect(profile.markdown).toContain("## Review edits before continuing");
  expect(profile.markdown).toContain("Guidance source: written by the user");
  expect(profile.ruleCount).toBe(1);
});
