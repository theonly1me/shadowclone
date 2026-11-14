import { describe, expect, test } from "bun:test";
import type { LiveBrief } from "@shadowclone/live";
import { fakeNode } from "./fixtures";
import { fakeLive, sampleRecord } from "./fleetFixtures";
import { pushFor } from "./notify/push";
import { nodeStates, type SessionState } from "./notify/states";

const idle = {
  ...sampleRecord({ id: "live-0000000a", state: "idle" }),
  repository: "you/secret-app",
};

const permission = {
  ...sampleRecord({ id: "live-0000000b", state: "needs-you" }),
  attention: "The session asks for a permission.",
};

function brief(options: Pick<LiveBrief, "kind" | "question">): LiveBrief {
  return {
    ...options,
    name: "Retire billing API",
    goal: "The owner wants the old billing API gone.",
    done: "The agent removed the callers.",
    options: [],
    messageDigest: "d1",
    writtenAt: "2026-10-18T11:30:01Z",
  };
}

async function statesWith(current: LiveBrief | null): Promise<readonly SessionState[]> {
  return nodeStates({
    node: fakeNode([]),
    live: {
      ...fakeLive([idle, permission]),
      currentBriefs: async () => new Map(current === null ? [] : [[idle.id, current]]),
    },
  });
}

describe("a push for a live session with a current brief", () => {
  test("a question brief waits for the owner, with the task name and the question", async () => {
    const [first, second] = await statesWith(
      brief({ kind: "question", question: "Delete the old endpoint?" }),
    );

    expect(first).toMatchObject({
      id: "live-0000000a",
      needsYou: true,
      question: "Delete the old endpoint?",
      questionId: "brief-d1",
      task: "Retire billing API",
    });
    expect(second).toMatchObject({ id: "live-0000000b", needsYou: true, task: null });
  });

  test("a finished brief does not wait, and no brief keeps the states of today", async () => {
    const [finished] = await statesWith(brief({ kind: "finished", question: null }));
    const [plain, needs] = await statesWith(null);

    expect(finished).toMatchObject({ needsYou: false, questionId: null });
    expect(plain).toMatchObject({ needsYou: false, question: null, task: null });
    expect(needs).toMatchObject({
      needsYou: true,
      question: "The session asks for a permission.",
      questionId: "2026-10-18T11:30:00Z",
    });
  });

  test("with text on, the push names the task and the question", async () => {
    const [state] = await statesWith(
      brief({ kind: "question", question: "Delete the old endpoint?" }),
    );

    expect(state === undefined ? null : pushFor({ node: "work", state, withText: true })).toEqual({
      title: "Live session live-0000000a needs you",
      body: "Retire billing API in you/secret-app on work: Delete the old endpoint?",
      urgent: true,
    });
  });

  test("with text off, the push has no task name and no question", async () => {
    const [state] = await statesWith(brief({ kind: "blocked", question: null }));
    const push = state === undefined ? null : pushFor({ node: "work", state, withText: false });

    expect(push).toEqual({
      title: "Live session live-0000000a needs you",
      body: "On work. Ask Claude about live-0000000a to see what it needs.",
      urgent: true,
    });
  });

  test("with no current brief, a push with text stays as it is today", async () => {
    const [, state] = await statesWith(null);

    expect(
      state === undefined ? null : pushFor({ node: "work", state, withText: true })?.body,
    ).toBe("you/app on work: The session asks for a permission.");
  });
});
