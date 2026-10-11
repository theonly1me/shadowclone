import { expect, test } from "bun:test";
import { buildCodexArguments } from "@shadowclone/agents";
import { prepareGuidedComments } from "./engine";
import { draftFixture } from "./fixtures";
import { draftRequestSchema } from "./schema";

test("comment preparation sends selected code context without unrelated changed-file source", async () => {
  const fixture = await draftFixture();
  let prompt = "";
  const request = draftRequestSchema.parse(fixture.input);
  await prepareGuidedComments({
    ...fixture.options,
    notes: request.notes,
    headSha: fixture.headSha,
    baseSha: fixture.baseSha,
    files: [
      {
        path: "job.ts",
        oldPath: "job.ts",
        diff: fixture.data.pulls[0]?.files[0]?.diff ?? "",
        base: "export const limit = 1;\n",
        head: "export const limit = 3;\n",
      },
      {
        path: "unrelated.ts",
        oldPath: "unrelated.ts",
        diff: "+SYNTHETIC_UNSELECTED_SOURCE",
        base: null,
        head: "SYNTHETIC_UNSELECTED_SOURCE",
      },
    ],
    engine: {
      id: "claude-code",
      runner: async (run) => {
        prompt = run.prompt;
        return fixture.engine.runner(run);
      },
    },
  });
  expect(prompt).toContain("export const limit = 3;");
  expect(prompt).not.toContain("SYNTHETIC_UNSELECTED_SOURCE");
});

test("Codex preparation uses its supported read-only review options", async () => {
  const fixture = await draftFixture();
  let arguments_: readonly string[] = [];
  await prepareGuidedComments({
    ...fixture.options,
    notes: draftRequestSchema.parse(fixture.input).notes,
    headSha: fixture.headSha,
    baseSha: fixture.baseSha,
    files: [],
    engine: {
      id: "codex",
      runner: async (run) => {
        arguments_ = buildCodexArguments({ run });
        return fixture.engine.runner(run);
      },
    },
  });
  expect(arguments_).toContain("--ephemeral");
  expect(arguments_).toContain('default_permissions="shadowclone-review"');
  expect(arguments_).toContain('web_search="disabled"');
});
