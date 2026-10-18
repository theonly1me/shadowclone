import { describe, expect, test } from "bun:test";
import { pushFor, type Push } from "./notify/push";
import type { NodeStates, SessionState } from "./notify/states";
import { createWatcher } from "./notify/watcher";

const question: SessionState = {
  id: "work0001",
  kind: "clone",
  repository: "you/secret-app",
  state: "waiting",
  needsYou: true,
  question: "Delete the old billing API?",
  questionId: "qabc123",
};

function watcherWith(options: {
  readonly rounds: (readonly NodeStates[])[];
  readonly url?: string | null;
}) {
  const sent: Push[] = [];
  let round = 0;
  const watcher = createWatcher({
    gather: async () => options.rounds[Math.min(round++, options.rounds.length - 1)] ?? [],
    settings: () => ({
      notifyUrl: options.url === undefined ? "https://ntfy.sh/topic" : options.url,
      notifyText: false,
    }),
    send: async ({ push }) => {
      sent.push(push);
    },
    log: () => undefined,
  });

  return { watcher, sent };
}

describe("phone pushes", () => {
  test("a push has no question text and no repository unless the owner turns text on", () => {
    const plain = pushFor({ node: "work", state: question, withText: false });
    const withText = pushFor({ node: "work", state: question, withText: true });

    expect(plain).toEqual({
      title: "Clone work0001 needs you",
      body: "On work. Ask Claude about work0001 to see what it needs.",
      urgent: true,
    });
    expect(JSON.stringify(plain)).not.toContain("billing");
    expect(JSON.stringify(plain)).not.toContain("secret-app");
    expect(withText.body).toBe("you/secret-app on work: Delete the old billing API?");
  });

  test("the first scan pushes nothing, and a new question then pushes once", async () => {
    const next = { ...question, questionId: "qdef456", question: "Keep the old webhook?" };
    const { watcher, sent } = watcherWith({
      rounds: [
        [{ node: "work", states: [question] }],
        [{ node: "work", states: [question] }],
        [{ node: "work", states: [next] }],
        [{ node: "work", states: [next] }],
      ],
    });

    for (let scan = 0; scan < 4; scan++) {
      await watcher.scan();
    }

    expect(sent.map((push) => push.title)).toEqual(["Clone work0001 needs you"]);
  });

  test("a node that joins later pushes nothing for the states it already had", async () => {
    const done = { ...question, needsYou: false, state: "done", question: null, questionId: null };
    const { watcher, sent } = watcherWith({
      rounds: [
        [{ node: "studio", states: [] }],
        [
          { node: "studio", states: [] },
          { node: "work", states: [done] },
        ],
      ],
    });

    await watcher.scan();
    await watcher.scan();

    expect(sent).toEqual([]);
  });

  test("a node that drops and returns does not push its old states again", async () => {
    const done = { ...question, needsYou: false, state: "done", question: null, questionId: null };
    const { watcher, sent } = watcherWith({
      rounds: [
        [{ node: "work", states: [] }],
        [{ node: "work", states: [done] }],
        [],
        [{ node: "work", states: [done] }],
      ],
    });

    for (let scan = 0; scan < 4; scan++) {
      await watcher.scan();
    }

    expect(sent.map((push) => push.title)).toEqual(["Clone work0001 done"]);
  });

  test("with no topic, nothing is sent", async () => {
    const { watcher, sent } = watcherWith({
      url: null,
      rounds: [[{ node: "work", states: [] }], [{ node: "work", states: [question] }]],
    });

    await watcher.scan();
    await watcher.scan();

    expect(sent).toEqual([]);
  });
});
