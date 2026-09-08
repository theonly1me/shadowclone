import { expect, test } from "bun:test";
import type { IndexedEvent } from "../../index";
import { learnEvaluationProfile } from "./profile";

function event(options: {
  readonly id: number;
  readonly kind: IndexedEvent["kind"];
  readonly toolName?: string;
}): IndexedEvent {
  return {
    id: options.id,
    sourcePath: "/fixture.jsonl",
    source: "claude-code",
    sessionId: "session",
    eventId: `event-${options.id}`,
    parentEventId: null,
    timestamp: options.id,
    cwd: "/repo",
    gitBranch: null,
    kind: options.kind,
    tool: options.toolName
      ? { toolUseId: `tool-${options.id}`, name: options.toolName }
      : null,
    isError: false,
    textRef: null,
  };
}

test("evaluation keeps an empty semantic profile without a structural fallback", async () => {
  const profile = await learnEvaluationProfile({
    events: [
      event({ id: 1, kind: "tool-call", toolName: "Edit" }),
      event({ id: 2, kind: "interruption" }),
    ],
    training: [
      {
        id: "training",
        sessionId: "claude-code:session",
        timestamp: 2,
        text: "Stop editing",
      },
    ],
    cutoff: 3,
    call: () => {
      throw new Error("An empty eligible set must not call the engine");
    },
    engine: "claude-code",
    directory: "/tmp",
  });

  expect(profile).toBe("# Shadowclone profile\n");
});
