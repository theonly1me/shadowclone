import { expect, test } from "bun:test";
import type { CorrectionSignal } from "../signal";
import { episodeId, selectLearningEpisodes, selectNewestLearningEpisodes, type LearningState } from "./state";

function signal(timestamp: number): CorrectionSignal {
  return {
    kind: "interruption",
    category: "tool:Edit",
    label: "while using Edit",
    sessionId: `session-${timestamp}`,
    timestamp,
    origin: {
      id: "github.com/acme",
      directoryName: "github.com--acme",
      promotable: true,
    },
    repositoryName: null,
    textRefs: [],
  };
}

const idleState: LearningState = {
  lastAttemptAt: null,
  lastCompletedAt: null,
  status: "idle",
  processed: [],
};

test("learning selects the sixty oldest pending episodes", () => {
  const now = 1_800_000_000_000;
  const signals = Array.from({ length: 65 }, (_, index) => signal(now - index));

  const selected = selectLearningEpisodes({ signals, state: idleState, now });

  expect(selected).toHaveLength(60);
  expect(selected[0]?.timestamp).toBe(now - 64);
  expect(selected.at(-1)?.timestamp).toBe(now - 5);
});

test("learning keeps reaching episodes beyond the former thirty day horizon", () => {
  const now = 1_800_000_000_000;
  const ancient = now - 400 * 24 * 60 * 60 * 1_000;

  const selected = selectLearningEpisodes({
    signals: [signal(ancient)],
    state: idleState,
    now,
  });

  expect(selected.map((entry) => entry.timestamp)).toEqual([ancient]);
});

test("learning never revisits an episode recorded in the ledger", () => {
  const now = 1_800_000_000_000;
  const [first] = [signal(now - 2)];
  if (!first) {
    throw new Error("Fixture signal was unavailable");
  }
  const signals = [first, signal(now - 1)];
  const state: LearningState = {
    ...idleState,
    processed: [{ id: episodeId(first), timestamp: now - 2 }],
  };

  const selected = selectLearningEpisodes({ signals, state, now });

  expect(selected.map((entry) => entry.timestamp)).toEqual([now - 1]);
});

test("setup learning chooses the newest pending episodes in chronological order", () => {
  const now = 1_800_000_000_000;
  const signals = [signal(now - 4), signal(now - 2), signal(now - 3), signal(now - 1)];
  const selected = selectNewestLearningEpisodes({
    signals,
    state: {
      ...idleState,
      processed: [{ id: episodeId(signals[1] ?? signal(now - 2)), timestamp: now - 2 }],
    },
    now,
    limit: 2,
  });
  expect(selected.map((entry) => entry.timestamp)).toEqual([now - 3, now - 1]);
});
