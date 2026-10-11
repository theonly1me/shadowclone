import { expect, test } from "bun:test";
import { rename, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { guidedFixture, guidedScript } from "./guidedFixtures";

const inventorySchema = z.object({
  pulls: z.array(
    z.object({
      files: z.array(
        z.object({
          path: z.string(),
          oldPath: z.string(),
          status: z.string(),
          binary: z.boolean(),
          base: z.string().nullable(),
          head: z.string().nullable(),
          additions: z.number(),
          deletions: z.number(),
        }),
      ),
    }),
  ),
});

test("the collected inventory preserves renamed, removed, binary, and unusual paths", async () => {
  const fixture = await guidedFixture();
  const renamed = "renamed job.ts";
  const unusual = "nested/line\nbreak.ts";
  await rename(path.join(fixture.checkout, "job.ts"), path.join(fixture.checkout, renamed));
  await rm(path.join(fixture.checkout, "guide.md"));
  await Bun.write(path.join(fixture.checkout, "image.bin"), new Uint8Array([0, 255, 1, 2]));
  await Bun.write(path.join(fixture.checkout, unusual), "export const value = 7;\n");
  fixture.git(["add", "."]);
  fixture.git(["commit", "-m", "feat: change the file inventory"]);
  const [pull] = fixture.input.pulls;
  const [group] = fixture.input.groups;
  if (!pull || !group) throw new Error("The fixture needs its PR and group.");
  pull.baseSha = fixture.headSha;
  pull.headSha = fixture.git(["rev-parse", "HEAD"]);
  fixture.input.evidence[0] = {
    id: "attempts",
    pr: pull.id,
    path: renamed,
    side: "HEAD",
    start: 1,
    end: 1,
    quote: "export const attempts = 3;",
  };
  group.files[0] = { pr: pull.id, path: renamed };
  await Bun.write(fixture.inputPath, JSON.stringify(fixture.input));
  const output = path.join(fixture.directory, "inventory.json");
  expect(
    (await guidedScript({ name: "collect", arguments: [fixture.inputPath, output] })).exitCode,
  ).toBe(0);
  const report = inventorySchema.parse(await Bun.file(output).json());
  const files = report.pulls.flatMap((item) => item.files);
  expect(files.map((file) => file.path).sort()).toEqual(
    ["guide.md", "image.bin", unusual, renamed].sort(),
  );
  expect(files.find((file) => file.path === renamed)).toMatchObject({
    oldPath: "job.ts",
    status: "R100",
    base: "export const attempts = 3;\n",
    head: "export const attempts = 3;\n",
    additions: 0,
    deletions: 0,
  });
  expect(files.find((file) => file.path === "guide.md")).toMatchObject({ status: "D", head: null });
  expect(files.find((file) => file.path === "image.bin")).toMatchObject({
    status: "A",
    binary: true,
    base: null,
    head: null,
  });
  expect(files.find((file) => file.path === unusual)).toMatchObject({
    status: "A",
    additions: 1,
    deletions: 0,
  });
});
