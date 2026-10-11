import { expect, test } from "bun:test";
import { stageGuidedNotes, preparedReviewSchema } from "./index";
import { draftFixture } from "./fixtures";

test("selected human notes become a verified pending inline review without a submission event or summary", async () => {
  const fixture = await draftFixture();
  const result = await stageGuidedNotes(fixture.options);
  expect(result).toEqual({
    url: "https://github.com/example/project/pull/1#pullrequestreview-9",
    stagedIds: ["human-note"],
    held: [],
  });
  expect(fixture.state.payloads).toEqual([
    {
      commit_id: fixture.headSha,
      comments: [
        { path: "job.ts", line: 1, side: "RIGHT", body: "Can we document why the limit is three?" },
      ],
    },
  ]);
  expect(fixture.state.modelCalls).toBe(1);
  expect(fixture.git(["rev-parse", "HEAD"])).toBe(fixture.headSha);
  expect(fixture.git(["worktree", "list", "--porcelain"]).match(/^worktree /gm)?.length).toBe(1);
});

test("a quote that does not match the current source prevents every GitHub write", async () => {
  const fixture = await draftFixture();
  fixture.state.reply = preparedReviewSchema.parse({
    comments: [
      {
        noteIds: ["human-note"],
        path: "job.ts",
        side: "RIGHT",
        startLine: 1,
        line: 1,
        body: "Can we document this?",
        quote: "export const limit = 99;",
      },
    ],
    held: [],
  });
  await expect(stageGuidedNotes(fixture.options)).rejects.toThrow("quote does not match");
  expect(fixture.state.payloads).toEqual([]);
});

test("the agent must account for every selected note before any comment is staged", async () => {
  const fixture = await draftFixture();
  fixture.state.reply = { comments: [], held: [] };
  await expect(stageGuidedNotes(fixture.options)).rejects.toThrow("omitted a selected note");
  expect(fixture.state.payloads).toEqual([]);
});

test("a held note remains local without creating an empty review", async () => {
  const fixture = await draftFixture();
  fixture.state.reply = {
    comments: [],
    held: [
      { id: "human-note", reason: "The proposed concern has no meaningful changed-line anchor." },
    ],
  };
  const result = await stageGuidedNotes(fixture.options);
  expect(result.stagedIds).toEqual([]);
  expect(result.held).toHaveLength(1);
  expect(result.url).toBeNull();
  expect(fixture.state.payloads).toEqual([]);
});
