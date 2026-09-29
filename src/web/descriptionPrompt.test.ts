import { expect, test } from "bun:test";
import { buildFixture } from "../builds/fixtures";
import { descriptionPrompt } from "./descriptionPrompt";

test("build description sends summaries without skill bodies or paths", async () => {
  const context = await buildFixture();
  const privateBody = "PRIVATE-BODY-MUST-NOT-BE-SENT";
  const prompt = await descriptionPrompt({
    ...context,
    input: {
      scope: "global",
      choices: { "custom:measure-carefully": true },
      edits: {},
      custom: [
        {
          name: "measure-carefully",
          description: "Compare a safe baseline before tuning performance.",
          body: privateBody,
        },
      ],
    },
  });

  expect(prompt).toContain("Compare a safe baseline");
  expect(prompt).not.toContain(privateBody);
  expect(prompt).not.toContain(context.cwd);
  expect(prompt).not.toContain('"owner"');
});
