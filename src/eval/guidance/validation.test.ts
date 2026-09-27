import { expect, test } from "bun:test";
import path from "node:path";
import { parseGuidanceArguments } from "../../cli/guidanceEval";
import { ownedWrite } from "../../storage";
import { fingerprint } from "../transfer/structured";
import { runValidation, validationId } from "./validation";
import { validationFixture } from "./validation.fixtures";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  saveGuidanceReceipt,
  saveGuidanceSuite,
} from "./store";

test("validation creates one linked allowance and preserves historical data and the deadline", async () => {
  const fixture = await validationFixture();

  try {
    const execute = async () =>
      readGuidanceReceipt({
        paths: fixture.paths,
        evalId: validationId(fixture.parent.evalId),
      });

    await Bun.write(
      path.join(fixture.directory, "workspace.json"),
      "Changed live file, not frozen evidence.",
    );

    const first = await runValidation({ options: fixture.options, execute });

    expect(first.limitUsd).toBeCloseTo(7.0277622);
    expect(first.repeat).toBe(2);
    expect(first.validation?.priorCalls).toBe(25);
    expect(first.suiteFingerprint).toBe(fixture.parent.suiteFingerprint);
    expect(first.judging?.packet.commit).toBe(fixture.parent.suite.baseCommit);
    expect(JSON.stringify(first.judging?.packet)).not.toContain(
      "Changed live file",
    );

    const second = await runValidation({
      options: { ...fixture.options, deadlineSeconds: 20 },
      execute,
    });

    expect(second.evalId).toBe(first.evalId);
    expect(second.deadlineAt).toBe(first.deadlineAt);
    expect(
      await readGuidanceReceipt({
        paths: fixture.paths,
        evalId: fixture.parent.evalId,
      }),
    ).toEqual(fixture.parent);
    expect(
      await Bun.file(path.join(fixture.parentDirectory, "budget.json")).json(),
    ).toEqual(fixture.parentBudget);

    for (const options of [
      { cumulativeBudgetUsd: 9 },
      { maximumCalls: 47 },
      { model: "claude-sonnet-5-other" },
    ]) {
      await expect(
        runValidation({ options: { ...fixture.options, ...options }, execute }),
      ).rejects.toThrow();
    }

    await saveGuidanceReceipt({
      paths: fixture.paths,
      receipt: {
        ...first,
        judging: first.judging
          ? { ...first.judging, promptFingerprint: "changed" }
          : undefined,
      },
    });

    await expect(
      runValidation({ options: fixture.options, execute }),
    ).rejects.toThrow("judge contract changed");
  } finally {
    await fixture.cleanup();
  }
}, 30000);

test("unresolved original cost or changed frozen sources blocks validation", async () => {
  const fixture = await validationFixture();

  try {
    const execute = async () => fixture.parent;

    for (const flags of [{ unknownCost: true }, { pending: true }]) {
      await ownedWrite({
        path: path.join(fixture.parentDirectory, "budget.json"),
        content: JSON.stringify({ ...fixture.parentBudget, ...flags }),
      });

      await expect(
        runValidation({ options: fixture.options, execute }),
      ).rejects.toThrow("unresolved");
    }

    await ownedWrite({
      path: path.join(fixture.parentDirectory, "budget.json"),
      content: JSON.stringify(fixture.parentBudget),
    });

    const child = await runValidation({
      options: fixture.options,
      execute: async (request) =>
        readGuidanceReceipt({
          paths: fixture.paths,
          evalId: request.evalId ?? "",
        }),
    });

    const directory = guidanceDirectory({
      paths: fixture.paths,
      evalId: child.evalId,
    });

    expect(fingerprint(child.suite)).toBe(fixture.parent.suiteFingerprint);

    await ownedWrite({
      path: path.join(fixture.parentDirectory, "budget.json"),
      content: JSON.stringify({ ...fixture.parentBudget, spentUsd: 3 }),
    });

    await expect(
      runValidation({ options: fixture.options, execute }),
    ).rejects.toThrow("accounting");
    expect(
      await Bun.file(path.join(directory, "budget.json")).json(),
    ).toHaveProperty("calls", 0);

    await ownedWrite({
      path: path.join(fixture.parentDirectory, "budget.json"),
      content: JSON.stringify(fixture.parentBudget),
    });
    await saveGuidanceSuite({
      paths: fixture.paths,
      suite: { ...fixture.parent.suite, profile: "Changed profile" },
    });

    await expect(
      runValidation({ options: fixture.options, execute }),
    ).rejects.toThrow("frozen suite changed");
  } finally {
    await fixture.cleanup();
  }
}, 30000);

test("validation CLI has independent explicit cumulative limits without weakening the old pilot", () => {
  const base = [
    "--protocol",
    "guidance-v1",
    "--repo",
    "/repo",
    "--model",
    "claude-sonnet-5",
    "--reasoning-effort",
    "medium",
    "--max-calls",
    "48",
    "--deadline-seconds",
    "2700",
    "--validation-of",
    crypto.randomUUID(),
    "--yes",
  ];

  expect(
    parseGuidanceArguments([...base, "--cumulative-budget-usd", "10"]),
  ).toHaveProperty("cumulativeBudgetUsd", 10);
  expect(() => parseGuidanceArguments(base)).toThrow("cumulative budget");
  expect(() =>
    parseGuidanceArguments([
      ...base,
      "--cumulative-budget-usd",
      "10",
      "--max-budget-usd",
      "5",
    ]),
  ).toThrow("cumulative budget");
  expect(() =>
    parseGuidanceArguments([
      ...base,
      "--cumulative-budget-usd",
      "10",
      "--pilot",
    ]),
  ).toThrow("cumulative budget");
});
