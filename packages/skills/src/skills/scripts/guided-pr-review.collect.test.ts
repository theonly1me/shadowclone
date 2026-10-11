import { expect, test } from "bun:test";
import path from "node:path";
import { collectedFixtureSchema, guidedFixture, guidedScript } from "./guidedFixtures";

test("the collector derives the complete file inventory and quotes from pinned Git objects", async () => {
  const fixture = await guidedFixture();
  const output = path.join(fixture.directory, "report.json");
  const result = await guidedScript({ name: "collect", arguments: [fixture.inputPath, output] });
  expect(result.exitCode).toBe(0);
  const report = collectedFixtureSchema.parse(await Bun.file(output).json());
  const [pull] = report.pulls;
  expect(pull?.files.map((file) => file.path).sort()).toEqual(["guide.md", "job.ts"]);
  expect(pull?.mergeBaseSha).toBe(fixture.baseSha);
  expect(report.evidence[0]?.text).toBe("export const attempts = 3;");
  expect(pull?.files.find((file) => file.path === "job.ts")?.diff).toContain(
    "+export const attempts = 3;",
  );
  expect(JSON.stringify(report)).not.toContain(fixture.checkout);
});

test("the three-PR guide records inheritance without attributing parent edits to a child", async () => {
  const fixture = await guidedFixture();
  await Bun.write(path.join(fixture.checkout, "state.ts"), "export const saved = true;\n");
  fixture.git(["add", "."]);
  fixture.git(["commit", "-m", "feat: save state"]);
  const secondSha = fixture.git(["rev-parse", "HEAD"]);
  await Bun.write(path.join(fixture.checkout, "notify.ts"), "export const notify = true;\n");
  fixture.git(["add", "."]);
  fixture.git(["commit", "-m", "feat: notify"]);
  const thirdSha = fixture.git(["rev-parse", "HEAD"]);
  const [first] = fixture.input.pulls;
  if (!first) throw new Error("The fixture needs a PR.");
  fixture.input.pulls.push({
    ...first,
    id: "pr-2",
    number: 2,
    url: "https://github.com/example/project/pull/2",
    baseSha: fixture.headSha,
    headSha: secondSha,
  });
  fixture.input.pulls.push({
    ...first,
    id: "pr-3",
    number: 3,
    url: "https://github.com/example/project/pull/3",
    baseSha: secondSha,
    headSha: thirdSha,
  });
  const [group] = fixture.input.groups;
  if (!group) throw new Error("The fixture needs a group.");
  group.prs.push("pr-3");
  group.files.push({ pr: "pr-3", path: "notify.ts" });
  await Bun.write(fixture.inputPath, JSON.stringify(fixture.input));
  const output = path.join(fixture.directory, "stack.json");
  expect(
    (await guidedScript({ name: "collect", arguments: [fixture.inputPath, output] })).exitCode,
  ).toBe(0);
  const report = collectedFixtureSchema.parse(await Bun.file(output).json());
  expect(report.stackEdges).toEqual([
    { from: "pr-1", to: "pr-2" },
    { from: "pr-1", to: "pr-3" },
    { from: "pr-2", to: "pr-3" },
  ]);
  expect(report.pulls.find((pull) => pull.id === "pr-3")?.files.map((file) => file.path)).toEqual([
    "notify.ts",
  ]);
  expect(report.combinedHead).toBe(thirdSha);
});

test("a mismatched quote stops collection without creating a report", async () => {
  const fixture = await guidedFixture();
  fixture.input.evidence[0] = {
    id: "attempts",
    pr: "pr-1",
    path: "job.ts",
    side: "HEAD",
    start: 1,
    end: 1,
    quote: "export const attempts = 9;",
  };
  await Bun.write(fixture.inputPath, JSON.stringify(fixture.input));
  const output = path.join(fixture.directory, "report.json");
  const result = await guidedScript({ name: "collect", arguments: [fixture.inputPath, output] });
  expect(result.exitCode).toBe(1);
  expect(result.error).toContain("does not match");
  expect(await Bun.file(output).exists()).toBeFalse();
});
