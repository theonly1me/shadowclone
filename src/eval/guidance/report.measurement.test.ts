import { expect, test } from "bun:test";
import { candidateFixture, guidanceFixture } from "./fixtures";
import { guidanceReport } from "./report";
import { fingerprint } from "../transfer/structured";
import type { GuidanceReceipt } from "./schema";

test("legacy counts and edit timing remain unreliable without rewriting historical evidence", () => {
  const suite = guidanceFixture();

  const run = {
    ...candidateFixture(),
    complete: true,
    requiredSkills: [{ name: "clean-code", loaded: true, beforeEdit: false }],
    reads: [{ path: "skills/clean-code/SKILL.md", beforeEdit: false }],
  };

  const receipt: GuidanceReceipt = {
    protocol: "guidance-v1",
    schemaVersion: 1,
    evalId: crypto.randomUUID(),
    suite,
    suiteFingerprint: fingerprint(suite),
    model: "claude-sonnet-5",
    effort: "medium",
    pilot: true,
    repeat: 1,
    maximumCalls: 28,
    limitUsd: 5,
    deadlineAt: 1,
    status: "complete",
    failure: null,
    runs: [run],
  };

  const before = fingerprint(receipt);
  const condition = guidanceReport(receipt).conditions.find(
    (entry) => entry.arm === "clone",
  );

  expect(condition?.repetitions[0]?.delivery).toBe("legacy-unreliable");
  expect(condition?.requiredSkills[0]).toEqual({
    name: "clean-code",
    loaded: null,
    beforeEdit: null,
  });
  expect(fingerprint(receipt)).toBe(before);

  const measured = guidanceReport({
    ...receipt,
    runs: [{ ...run, measurementVersion: 2, actions: [] }],
  }).conditions.find((entry) => entry.arm === "clone");

  expect(measured?.requiredSkills[0]).toEqual(run.requiredSkills[0]);
});
