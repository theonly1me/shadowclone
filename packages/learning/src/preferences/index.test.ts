import { expect, test } from "bun:test";
import { listRevisions } from "@shadowclone/changes";
import { learningSnapshot } from "@shadowclone/environment";
import { environmentFixture } from "@shadowclone/environment/testing";
import { integrationFixture } from "@shadowclone/core/testing";
import { rememberPreference } from "./index";

async function remembered(options: { readonly paths: Parameters<typeof learningSnapshot>[0]; readonly key: string }) {
  const snapshot = await learningSnapshot(options.paths);

  return snapshot.rules.find(({ rule }) => rule.key === options.key)?.rule;
}

test("explicit preferences are active, scoped to the repository, and recorded as a revision", async () => {
  const setup = await environmentFixture();
  const key = await rememberPreference({
    ...setup,
    text: "Prefer composition for extension points.",
    scope: "repository",
  });
  const rule = await remembered({ paths: setup.paths, key });

  expect(key).toStartWith("declared-");
  expect(rule).toMatchObject({
    title: "Prefer composition for extension points",
    status: "active",
    source: "declared",
    scope: "org",
  });
  expect(await listRevisions(setup.paths)).toHaveLength(1);
});

test("long explicit preferences use a complete clause as their title", async () => {
  const setup = await environmentFixture();
  const key = await rememberPreference({
    ...setup,
    text: "Before committing or pushing, stop and ask the maintainer to review the completed diff, with a proposed one-line commit message. Do not commit.",
    scope: "global",
  });

  expect((await remembered({ paths: setup.paths, key }))?.title).toBe(
    "Before committing or pushing, stop and ask the maintainer to review the completed diff",
  );
});

test("explicit preferences escape both HTML comment closing forms", async () => {
  const setup = await environmentFixture();
  const key = await rememberPreference({
    ...setup,
    text: "Preserve literal examples: <!-- ordinary --> and <!-- alternate --!>.",
    scope: "global",
  });
  const body = (await remembered({ paths: setup.paths, key }))?.body ?? "";

  expect(body).toContain("&lt;!-- ordinary --&gt;");
  expect(body).toContain("&lt;!-- alternate --!&gt;");
  expect(body).not.toContain("--!>");
});

test("remembering a preference before setup says to run init", async () => {
  const setup = await integrationFixture();

  await expect(
    rememberPreference({ ...setup, text: "Prefer composition.", scope: "global" }),
  ).rejects.toThrow("Shadowclone has no skills environment yet. Run shadowclone init first.");
});
