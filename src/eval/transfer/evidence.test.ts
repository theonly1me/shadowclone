import { expect, test } from "bun:test";
import { trainingEvidence } from "./evidence";
import type { Evidence } from "./types";

const first: Evidence = { id: "older", sessionId: "older", timestamp: 10, text: "Use full variable names" };
const task: Evidence = { id: "task", sessionId: "heldout", timestamp: 20, text: "Implement the parser" };

test("excludes heldout sessions, later events and related solutions before learning", () => {
  const evidence = [first, { ...first, id: "related", sessionId: "related" },
    { ...task, id: "early-same-session", timestamp: 5 }, task,
    { ...first, id: "later", timestamp: 30 }];
  expect(trainingEvidence({ evidence, task, excludedSessions: new Set(["related"]) })).toEqual([first]);
});
