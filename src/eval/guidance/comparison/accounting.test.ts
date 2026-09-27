import { expect, test } from "bun:test";
import path from "node:path";
import { fingerprint } from "../../transfer/structured";
import { guidanceReport } from "../report";
import {
  guidanceDirectory,
  readGuidanceSuite,
  saveGuidanceReceipt,
  saveGuidanceSuite,
} from "../store";
import { comparisonFixture } from "./fixtures";
import { comparisonIdentity, runComparison } from "./index";

test("comparison carries the entire historical accounting chain into one stable allowance", async () => {
  const fixture = await comparisonFixture();

  try {
    const first = await fixture.initialize();

    expect(first.evalId).toBe(comparisonIdentity(fixture.parent.evalId));
    expect(first.comparison?.priorSpentUsd).toBeCloseTo(16.7583498, 7);
    expect(first.comparison?.priorCalls).toBe(121);
    expect(first.limitUsd).toBe(20);
    expect(first.maximumCalls).toBe(96);
    expect(first.pilot).toBeFalse();
    expect(first.repeat).toBe(2);
    expect(first.judging?.version).toBe(4);
    expect(first.suite).toEqual(fixture.parent.suite);
    expect(first.judging?.packetFingerprint).toBe(
      fixture.parent.judging?.packetFingerprint,
    );
    expect(guidanceReport(first).expectedResponses).toBe(32);

    const resumed = await fixture.initialize();

    expect(resumed.deadlineAt).toBe(first.deadlineAt);
    expect(resumed).toEqual(first);

    for (const changed of [
      { additionalBudgetUsd: 19 },
      { maximumCalls: 95 },
      { deadlineSeconds: 5000 },
      { model: "claude-sonnet-5-other" },
    ]) {
      await expect(
        runComparison({
          options: { ...fixture.request, ...changed },
          execute: async () => first,
        }),
      ).rejects.toThrow();
    }

    const budgetPath = path.join(
      guidanceDirectory({ paths: fixture.paths, evalId: first.evalId }),
      "budget.json",
    );

    expect(await Bun.file(budgetPath).json()).toHaveProperty("calls", 0);

    await saveGuidanceReceipt({
      paths: fixture.paths,
      receipt: {
        ...first,
        judging: first.judging
          ? { ...first.judging, promptFingerprint: "changed" }
          : undefined,
      },
    });

    await expect(fixture.initialize()).rejects.toThrow(
      "judge contract changed",
    );
  } finally {
    await fixture.cleanup();
  }
}, 30000);

test("comparison rejects unresolved or changed parents, recursive allowances, and changed sources", async () => {
  const fixture = await comparisonFixture();

  try {
    const parentBudgetPath = path.join(fixture.parentDirectory, "budget.json");

    for (const changed of [{ unknownCost: true }, { pending: true }]) {
      await Bun.write(
        parentBudgetPath,
        JSON.stringify({ ...fixture.parentBudget, ...changed }),
      );

      await expect(fixture.initialize()).rejects.toThrow("unresolved");
    }

    await Bun.write(parentBudgetPath, JSON.stringify(fixture.parentBudget));

    const first = await fixture.initialize();

    await Bun.write(
      parentBudgetPath,
      JSON.stringify({ ...fixture.parentBudget, spentUsd: 6 }),
    );

    await expect(fixture.initialize()).rejects.toThrow("accounting");

    await Bun.write(parentBudgetPath, JSON.stringify(fixture.parentBudget));

    const suite = await readGuidanceSuite({
      paths: fixture.paths,
      suiteId: first.suite.suiteId,
    });

    await saveGuidanceSuite({
      paths: fixture.paths,
      suite: { ...suite, profile: "Changed profile" },
    });

    await expect(fixture.initialize()).rejects.toThrow("frozen suite changed");

    await saveGuidanceSuite({ paths: fixture.paths, suite });

    await expect(
      runComparison({
        options: { ...fixture.request, comparisonOf: first.evalId },
        execute: async () => first,
      }),
    ).rejects.toThrow("completed maintenance");

    const priorBudgetPath = path.join(
      guidanceDirectory({ paths: fixture.paths, evalId: fixture.prior.evalId }),
      "budget.json",
    );
    const priorBudget = await Bun.file(priorBudgetPath).json();

    await Bun.write(
      priorBudgetPath,
      JSON.stringify({ ...priorBudget, spentUsd: 0 }),
    );

    await expect(fixture.initialize()).rejects.toThrow(
      "accounting chain changed",
    );
    expect(fingerprint(first.suite)).toBe(fixture.parent.suiteFingerprint);
  } finally {
    await fixture.cleanup();
  }
}, 30000);
