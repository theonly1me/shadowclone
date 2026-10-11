import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { build, embedded, fixture } from "./guidedFixture.js";

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

test("shell dollar quotes remain literal in the guide and embedded review data", async () => {
  const context = await fixture();
  context.input.summary = "Inspect $'line\\n' and $$ without changing their meaning.";
  await writeFile(context.inputPath, JSON.stringify(context.input));
  expect(build(context).exitCode).toBe(0);
  const html = await Bun.file(context.outputPath).text();
  expect(embedded(html)).toMatchObject({ summary: context.input.summary });
  expect(html).toContain("Inspect $&#39;line\\n&#39; and $$ without changing their meaning.");
});

test("the reading story shows definitions and their diffs before callers and supporting files", async () => {
  const context = await fixture();
  const [group] = context.input.groups;
  if (!group) throw new Error("The fixture needs a reading group.");
  const input = {
    ...context.input,
    groups: [
      {
        ...group,
        steps: [
          {
            title: "Define the retry defaults",
            text: "Read the declaration before its use.",
            evidence: ["retry"],
            definitions: ["retry"],
            files: [{ pr: "pr-1", path: "job.ts" }],
          },
          {
            title: "Use the defaults",
            text: "Read the usage after the contract.",
            evidence: [],
            files: [{ pr: "pr-2", path: "README.md" }],
          },
        ],
      },
    ],
  };
  await writeFile(context.inputPath, JSON.stringify(input));
  expect(build(context).exitCode).toBe(0);
  const document = await Bun.file(context.outputPath).text();
  expect(embedded(document)).toMatchObject({
    fileOrder: [
      "pr-1:job.ts",
      "pr-3:job.ts",
      "pr-2:README.md",
      "pr-2:blob.bin",
      'pr-2:quoted "name".txt',
    ],
  });
  const html = document.split('<script type="application/json"')[0];
  if (!html) throw new Error("The guide needs visible content.");
  const declaration = html.indexOf("export const attempts = 3;");
  const definitionDiff = html.indexOf('data-file="pr-1:job.ts"');
  const usage = html.indexOf("Use the defaults");
  const usageDiff = html.indexOf('data-file="pr-2:README.md"');
  const supportingDiff = html.indexOf('data-file="pr-2:blob.bin"');
  expect(declaration).toBeGreaterThan(0);
  expect(definitionDiff).toBeGreaterThan(declaration);
  expect(usage).toBeGreaterThan(definitionDiff);
  expect(usageDiff).toBeGreaterThan(usage);
  expect(supportingDiff).toBeGreaterThan(usageDiff);
});

test("every file starts expanded and links to its own PR diff, including the stack's supporting files", async () => {
  const context = await fixture();
  expect(build(context).exitCode).toBe(0);
  const html = (await Bun.file(context.outputPath).text()).split(
    '<script type="application/json"',
  )[0];
  if (!html) throw new Error("The guide needs visible content.");
  const cards = [...html.matchAll(/<details class="file-card"[^>]*>/g)].map((match) => match[0]);
  expect(cards).toHaveLength(9);
  expect(cards.every((card) => /\bopen\b/.test(card))).toBeTrue();
  expect(html).toContain(
    'href="https://github.com/example/project/pull/1/files#diff-15cfbe4f3fcd35b15ec7bf71a50e271a12f96d89a1e0b9b6c14d85f0869eb494"',
  );
  expect(html).toContain(
    'href="https://github.com/example/project/pull/2/files#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5"',
  );
  expect(html).not.toContain(
    'href="https://github.com/example/project/pull/3/files#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5"',
  );
  expect(html).toContain("Open file in PR");
});
