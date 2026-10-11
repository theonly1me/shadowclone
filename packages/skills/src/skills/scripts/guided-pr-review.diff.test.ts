import { expect, test } from "bun:test";
import path from "node:path";
import { z } from "zod";
import { guidedFixture, guidedScript } from "./guidedFixtures";

const reportSchema = z.object({
  pulls: z.array(
    z.object({
      files: z.array(
        z.object({
          rows: z.array(
            z.object({
              kind: z.string(),
              oldLine: z.number().nullable(),
              newLine: z.number().nullable(),
              text: z.string(),
            }),
          ),
        }),
      ),
    }),
  ),
});

test("the rendered diff retains additions and removals when cached rows are empty", async () => {
  const fixture = await guidedFixture();
  const collected = path.join(fixture.directory, "report.json");
  expect(
    (await guidedScript({ name: "collect", arguments: [fixture.inputPath, collected] })).exitCode,
  ).toBe(0);
  const original = await Bun.file(collected).text();
  await Bun.write(
    collected,
    original.replace(/"rows":\[[\s\S]*?\],"additions"/g, '"rows":[],"additions"'),
  );
  const output = path.join(fixture.directory, "review.html");
  expect((await guidedScript({ name: "render", arguments: [collected, output] })).exitCode).toBe(0);
  const html = await Bun.file(output).text();
  const data = /<script type="application\/json" id="guided-review">([\s\S]*?)<\/script>/.exec(
    html,
  )?.[1];
  if (!data) throw new Error("The report has no embedded data.");
  const report = reportSchema.parse(JSON.parse(data));
  const rows = report.pulls.flatMap((pull) => pull.files.flatMap((file) => file.rows));
  expect(rows).toContainEqual({
    kind: "remove",
    oldLine: 1,
    newLine: null,
    text: "export const attempts = 1;",
  });
  expect(rows).toContainEqual({
    kind: "add",
    oldLine: null,
    newLine: 1,
    text: "export const attempts = 3;",
  });
});
