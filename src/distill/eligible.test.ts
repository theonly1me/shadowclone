import { expect, test } from "bun:test";
import type { IndexedEvent } from "../index";
import type { CorrectionSignal } from "../signal";
import {
  allowlistedSignals,
  isEligibleForDistillation,
} from "./index";

function indexedEvent(kind: IndexedEvent["kind"]): IndexedEvent {
  return {
    id: 1,
    sourcePath: "/fixture.jsonl",
    source: "claude-code",
    sessionId: "session",
    eventId: "event",
    parentEventId: null,
    timestamp: 0,
    cwd: "/repo",
    gitBranch: null,
    kind,
    tool: null,
    isError: false,
    textRef: {
      type: "file",
      sourcePath: "/fixture.jsonl",
      byteOffset: 0,
      byteLength: 10,
    },
  };
}

test("allows user-authored and correction events with text pointers", () => {
  expect(isEligibleForDistillation(indexedEvent("user-prompt"))).toBeTrue();
  expect(isEligibleForDistillation(indexedEvent("question-asked"))).toBeTrue();
});

test("rejects tool results and thinking even if a pointer is present", () => {
  expect(isEligibleForDistillation(indexedEvent("tool-call"))).toBeFalse();
  expect(isEligibleForDistillation(indexedEvent("tool-result"))).toBeFalse();
  expect(isEligibleForDistillation(indexedEvent("thinking"))).toBeFalse();
  expect(isEligibleForDistillation(indexedEvent("assistant-text"))).toBeFalse();
});

test("removes a tool result pointer before a distillation batch", () => {
  const event = indexedEvent("tool-result");
  const ref = event.textRef;
  if (ref === null) {
    throw new Error("Expected fixture pointer");
  }
  const signal: CorrectionSignal = {
    kind: "interruption",
    category: "fixture",
    label: "fixture",
    sessionId: "session",
    timestamp: 0,
    origin: {
      id: "github.com/acme",
      directoryName: "github.com--acme",
      promotable: true,
    },
    textRefs: [ref],
  };

  expect(allowlistedSignals({ signals: [signal], events: [event] })[0]?.textRefs)
    .toEqual([]);
});

test("allows assistant text only through a correction signal", () => {
  const event = indexedEvent("assistant-text");
  const ref = event.textRef;
  if (ref === null) {
    throw new Error("Expected fixture pointer");
  }
  const signal: CorrectionSignal = {
    kind: "interruption",
    category: "assistant-text",
    label: "during an explanation",
    sessionId: "session",
    timestamp: 0,
    origin: {
      id: "github.com/acme",
      directoryName: "github.com--acme",
      promotable: true,
    },
    textRefs: [ref],
  };

  expect(allowlistedSignals({ signals: [signal], events: [event] })[0]?.textRefs)
    .toEqual([ref]);
});
