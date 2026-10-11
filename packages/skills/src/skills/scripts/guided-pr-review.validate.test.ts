import { expect, test } from "bun:test";
import path from "node:path";
import { guidedFixture, guidedScript } from "./guidedFixtures";

test("uncollected data and evidence-free diagrams cannot be presented as a validated review", async () => {
  const fixture = await guidedFixture();
  const output = path.join(fixture.directory, "review.html");
  expect(
    (await guidedScript({ name: "render", arguments: [fixture.inputPath, output] })).exitCode,
  ).toBe(1);
  const input = {
    ...fixture.input,
    groups: fixture.input.groups.map((group) => ({
      ...group,
      diagram: { nodes: [{ id: "save", label: "Save", evidence: [] }], edges: [] },
    })),
  };
  await Bun.write(fixture.inputPath, JSON.stringify(input));
  const result = await guidedScript({
    name: "collect",
    arguments: [fixture.inputPath, path.join(fixture.directory, "report.json")],
  });
  expect(result.exitCode).toBe(1);
  expect(result.error).toContain("node needs code evidence");
});

test("a document with a remote script fails validation", async () => {
  const fixture = await guidedFixture();
  const collected = path.join(fixture.directory, "report.json");
  const output = path.join(fixture.directory, "review.html");
  expect(
    (await guidedScript({ name: "collect", arguments: [fixture.inputPath, collected] })).exitCode,
  ).toBe(0);
  expect((await guidedScript({ name: "render", arguments: [collected, output] })).exitCode).toBe(0);
  await Bun.write(
    output,
    (await Bun.file(output).text()).replace(
      "</body>",
      '<script src="https://example.com/tracker.js"></script></body>',
    ),
  );
  const result = await guidedScript({ name: "validate", arguments: [output] });
  expect(result.exitCode).toBe(1);
  expect(result.error).toContain("remote assets");
});
