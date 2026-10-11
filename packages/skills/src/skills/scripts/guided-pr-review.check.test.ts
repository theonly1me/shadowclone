import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { build, command, fixture } from "./guidedFixture.js";

test("the validator reports the actual file count and rejects a note targeted at another PR", async () => {
  const context = await fixture();
  expect(build(context).exitCode).toBe(0);
  expect(command({ script: "scripts/check.mjs", arguments: [context.outputPath] })).toEqual({
    exitCode: 0,
    output: "check: 3 PRs, 5/5 files in the route, 0 human notes\n",
    error: "",
  });
  const html = await Bun.file(context.outputPath).text();
  await writeFile(
    context.outputPath,
    html.replace(
      '"notes":[]',
      '"notes":[{"id":"note","pr":"pr-99","anchor":"flow:summary","quote":"retries","body":"Question","ranges":[]}]',
    ),
  );
  expect(command({ script: "scripts/check.mjs", arguments: [context.outputPath] }).exitCode).toBe(
    1,
  );
});
