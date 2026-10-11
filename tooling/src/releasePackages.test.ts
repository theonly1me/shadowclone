import { expect, test } from "bun:test";
import { pendingReleasePackages } from "./releasePackages";

test("a partial publication requests only the missing skills package", async () => {
  const urls: string[] = [];
  const pending = await pendingReleasePackages({
    cliName: "@shadowclone/cli",
    skillsName: "@shadowclone/skills",
    version: "1.2.3",
    status: async (url) => {
      urls.push(url);
      return url.includes("skills") ? 404 : 200;
    },
  });
  expect(pending).toEqual({ tag: "v1.2.3", cliMissing: false, skillsMissing: true });
  expect(urls).toEqual([
    "https://registry.npmjs.org/%40shadowclone%2Fcli/1.2.3",
    "https://registry.npmjs.org/%40shadowclone%2Fskills/1.2.3",
  ]);
});

test("fully published packages do not trigger another publication", async () => {
  expect(
    await pendingReleasePackages({
      cliName: "@shadowclone/cli",
      skillsName: "@shadowclone/skills",
      version: "1.2.3",
      status: async () => 200,
    }),
  ).toEqual({ tag: null, cliMissing: false, skillsMissing: false });
});

test("a registry failure cannot be mistaken for a missing package", async () => {
  await expect(
    pendingReleasePackages({
      cliName: "@shadowclone/cli",
      skillsName: "@shadowclone/skills",
      version: "1.2.3",
      status: async () => 503,
    }),
  ).rejects.toThrow("npm registry answered 503");
});
