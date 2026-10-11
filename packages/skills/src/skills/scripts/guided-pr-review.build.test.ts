import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { build, fixture } from "./guidedFixture.js";

test("the builder rejects an incomplete route and never replaces an annotated file", async () => {
  const context = await fixture();
  const [group] = context.input.groups;
  if (!group) throw new Error("Missing fixture group.");
  group.files = group.files.filter((file) => file.path !== "blob.bin");
  await writeFile(context.inputPath, JSON.stringify(context.input));
  const incomplete = build(context);
  expect(incomplete.exitCode).toBe(1);
  expect(incomplete.error).toContain("omits 1 changed files:\npr-2:blob.bin");
  expect(await Bun.file(context.outputPath).exists()).toBeFalse();

  group.files.push({ pr: "pr-2", path: "blob.bin" });
  await writeFile(context.inputPath, JSON.stringify(context.input));
  expect(build(context).exitCode).toBe(0);
  const saved = await Bun.file(context.outputPath).text();
  expect(build(context).exitCode).toBe(1);
  expect(await Bun.file(context.outputPath).text()).toBe(saved);
});

test("a fabricated source quote fails before an HTML is written", async () => {
  const context = await fixture();
  const [evidence] = context.input.evidence;
  if (!evidence) throw new Error("Missing fixture evidence.");
  evidence.quote = "export const attempts = 9;";
  await writeFile(context.inputPath, JSON.stringify(context.input));
  expect(build(context)).toMatchObject({
    exitCode: 1,
    error: expect.stringContaining("Source evidence does not match: job.ts:1"),
  });
  expect(await Bun.file(context.outputPath).exists()).toBeFalse();
});
