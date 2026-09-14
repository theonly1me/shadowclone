import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
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

test("evaluation requires an active current profile", async () => {
  const profileDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-empty-profile-"),
  );

  expect(
    loadEvaluationProfile({ profileDirectory, repository }),
  ).rejects.toThrow("active Shadowclone profile");
});
