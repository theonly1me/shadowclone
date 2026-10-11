import { expect, test } from "bun:test";
import path from "node:path";
import { guidedFixture, guidedScript } from "./guidedFixtures";

for (const runtime of [process.execPath, Bun.which("node")].filter(
  (value): value is string => value !== null,
)) {
  test(
    path.basename(runtime) +
      ": the HTML contains real evidence, Markdown, ownership, and offline notes without executing PR content",
    async () => {
      const fixture = await guidedFixture();
      const [group] = fixture.input.groups;
      if (!group) throw new Error("The fixture needs a group.");
      group.summary = "Read **three attempts** and inspect the source.";
      await Bun.write(fixture.inputPath, JSON.stringify(fixture.input));
      const collected = path.join(fixture.directory, "report.json");
      expect(
        (
          await guidedScript({
            runtime,
            name: "collect",
            arguments: [fixture.inputPath, collected],
          })
        ).exitCode,
      ).toBe(0);
      const output = path.join(fixture.directory, "review.html");
      const result = await guidedScript({
        runtime,
        name: "render",
        arguments: [collected, output],
      });
      expect(result.exitCode).toBe(0);
      const html = await Bun.file(output).text();
      expect(html).toContain("await connectShadowclone();");
      expect(html).toContain("<strong>three attempts</strong>");
      expect(/Investigation coverage: ([^<]+)/.exec(html)?.[1]).toBe(
        "0 reviewed · 0 generated · 2 unexamined",
      );
      expect(html).toContain("export const attempts = 3;");
      expect(html).not.toContain('data-pr-tab="pr-1"');
      expect(html).toContain('data-guide-step="retry"');
      expect(html).toContain('id="note-editor"');
      expect(html).toContain('id="stage-review"');
      expect(html).toContain(fixture.headSha + "/job.ts#L1");
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("\\u003cscript>");
      expect(html).not.toMatch(/<script[^>]+src=/);
      expect(
        (await guidedScript({ runtime, name: "validate", arguments: [output] })).exitCode,
      ).toBe(0);
    },
  );
}

test("rendering refuses to replace an existing annotated document", async () => {
  const fixture = await guidedFixture();
  const collected = path.join(fixture.directory, "report.json");
  expect(
    (await guidedScript({ name: "collect", arguments: [fixture.inputPath, collected] })).exitCode,
  ).toBe(0);
  const output = path.join(fixture.directory, "review.html");
  await Bun.write(output, "Preserve my document.");
  const result = await guidedScript({ name: "render", arguments: [collected, output] });
  expect(result.exitCode).toBe(1);
  expect(await Bun.file(output).text()).toBe("Preserve my document.");
});
