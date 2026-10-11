import { expect, test } from "bun:test";
import { stageGuidedNotes } from "./index";
import { draftFixture } from "./fixtures";

test("a lost create-review response recovers the existing pending review instead of posting twice", async () => {
  const fixture = await draftFixture();
  fixture.state.loseResponse = true;
  await expect(stageGuidedNotes(fixture.options)).rejects.toThrow("response was lost");
  const recovered = await stageGuidedNotes(fixture.options);
  expect(recovered.stagedIds).toEqual(["human-note"]);
  expect(fixture.state.payloads).toHaveLength(1);
  expect(fixture.state.modelCalls).toBe(1);
});

test("an existing manual pending review prevents replacement and model invocation", async () => {
  const fixture = await draftFixture();
  fixture.state.reviews.push({
    id: 22,
    state: "PENDING",
    html_url: "https://github.com/example/project/pull/1#pullrequestreview-22",
    commit_id: fixture.headSha,
    user: { login: "example-reviewer" },
    body: "Manual draft",
    submitted_at: null,
  });
  await expect(stageGuidedNotes(fixture.options)).rejects.toThrow("manual comments are preserved");
  expect(fixture.state.payloads).toEqual([]);
  expect(fixture.state.modelCalls).toBe(0);
  expect(fixture.state.reviews[0]?.body).toBe("Manual draft");
});

test("a changed head during preparation blocks stale comment anchors", async () => {
  const fixture = await draftFixture();
  fixture.state.beforeReply = async () => {
    fixture.state.headSha = "a".repeat(40);
  };
  await expect(stageGuidedNotes(fixture.options)).rejects.toThrow(
    "changed while the agent prepared",
  );
  expect(fixture.state.payloads).toEqual([]);
});

test("a wrong read-back anchor cannot be reported as a successfully staged review", async () => {
  const fixture = await draftFixture();
  fixture.state.wrongAnchor = true;
  await expect(stageGuidedNotes(fixture.options)).rejects.toThrow("anchor differs");
  expect(fixture.state.payloads).toHaveLength(1);
});

test("unselected notes and empty selections never start a review", async () => {
  const fixture = await draftFixture();
  await expect(
    stageGuidedNotes({ ...fixture.options, input: { ...fixture.input, notes: [] } }),
  ).rejects.toThrow();
  await expect(
    stageGuidedNotes({
      ...fixture.options,
      input: {
        ...fixture.input,
        notes: fixture.input.notes.map((note) => ({ ...note, selected: false })),
      },
    }),
  ).rejects.toThrow();
  expect(fixture.state.modelCalls).toBe(0);
  expect(fixture.state.payloads).toEqual([]);
});
