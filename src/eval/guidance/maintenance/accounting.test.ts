import { expect, test } from "bun:test";
import path from "node:path";
import { parseGuidanceArguments } from "../../../cli/guidanceEval";
import { fingerprint } from "../../transfer/structured";
import { guidanceDirectory, readGuidanceReceipt, readGuidanceSuite, saveGuidanceReceipt, saveGuidanceSuite } from "../store";
import { maintenanceFixture } from "./fixtures";
import { runMaintenance } from "./index";

test("maintenance creates one allowance with nonduplicated accounting and immutable contract", async () => {
  const fixture = await maintenanceFixture();
  try {
    const first = await fixture.initialize();
    expect(first.limitUsd).toBe(10);
    expect(first.maintenance?.priorSpentUsd).toBeCloseTo(9.5016376, 7);
    expect(first.maintenance?.priorCalls).toBe(73);
    expect(first.judging?.version).toBe(4);
    expect(first.repeat).toBe(2);
    const second = await fixture.initialize();
    expect(second.evalId).toBe(first.evalId);
    expect(second.deadlineAt).toBe(first.deadlineAt);
    expect(fingerprint(await readGuidanceReceipt({ paths: fixture.paths, evalId: fixture.parent.evalId }))).toBe(fingerprint(fixture.parent));
    expect(await Bun.file(path.join(fixture.parentDirectory, "budget.json")).json()).toEqual(fixture.parentBudget);
    for (const changed of [{ additionalBudgetUsd: 9 }, { maximumCalls: 47 }, { deadlineSeconds: 20 }, { model: "claude-sonnet-5-other" }]) {
      await expect(runMaintenance({ options: { ...fixture.request, ...changed }, execute: async () => first })).rejects.toThrow();
    }
    const directory = guidanceDirectory({ paths: fixture.paths, evalId: first.evalId });
    expect(await Bun.file(path.join(directory, "budget.json")).json()).toHaveProperty("calls", 0);
    await saveGuidanceReceipt({ paths: fixture.paths, receipt: { ...first, judging: first.judging ? { ...first.judging, promptFingerprint: "changed" } : undefined } });
    await expect(fixture.initialize()).rejects.toThrow("judge contract changed");
  } finally { await fixture.cleanup(); }
}, 30000);

test("maintenance blocks historical cost uncertainty, modified sources, and recursive allowances", async () => {
  const fixture = await maintenanceFixture();
  try {
    const parentBudgetPath = path.join(fixture.parentDirectory, "budget.json");
    for (const changed of [{ pending: true }, { unknownCost: true }]) {
      await Bun.write(parentBudgetPath, JSON.stringify({ ...fixture.parentBudget, ...changed }));
      await expect(fixture.initialize()).rejects.toThrow("unresolved");
    }
    await Bun.write(parentBudgetPath, JSON.stringify(fixture.parentBudget));
    const first = await fixture.initialize();
    await Bun.write(parentBudgetPath, JSON.stringify({ ...fixture.parentBudget, spentUsd: 6 }));
    await expect(fixture.initialize()).rejects.toThrow("accounting");
    await Bun.write(parentBudgetPath, JSON.stringify(fixture.parentBudget));
    const suite = await readGuidanceSuite({ paths: fixture.paths, suiteId: first.suite.suiteId });
    await saveGuidanceSuite({ paths: fixture.paths, suite: { ...suite, profile: "New profile" } });
    await expect(fixture.initialize()).rejects.toThrow("unapproved source delta");
    await saveGuidanceSuite({ paths: fixture.paths, suite });
    await expect(runMaintenance({ options: { ...fixture.request, maintenanceOf: first.evalId }, execute: async () => first })).rejects.toThrow("completed measurement validation");
    const originalBudgetPath = path.join(guidanceDirectory({ paths: fixture.paths, evalId: fixture.original.evalId }), "budget.json");
    await Bun.write(originalBudgetPath, JSON.stringify({ ...fixture.parentBudget, limitUsd: 5, maximumCalls: 28, spentUsd: 0, calls: 0 }));
    await expect(fixture.initialize()).rejects.toThrow("Original pilot accounting");
  } finally { await fixture.cleanup(); }
}, 30000);

test("maintenance CLI requires a distinct explicit additional allowance and exact model", () => {
  const base = ["--protocol", "guidance-v1", "--repo", "/repo", "--model", "claude-sonnet-5", "--reasoning-effort", "medium",
    "--max-calls", "48", "--deadline-seconds", "2700", "--maintenance-of", crypto.randomUUID(), "--suite-id", crypto.randomUUID(), "--yes"];
  expect(parseGuidanceArguments([...base, "--additional-budget-usd", "10"])).toHaveProperty("additionalBudgetUsd", 10);
  expect(() => parseGuidanceArguments(base)).toThrow("additional budget");
  for (const extra of [["--max-budget-usd", "10"], ["--cumulative-budget-usd", "10"], ["--pilot"], ["--validation-of", crypto.randomUUID()], ["--max-calls", "49"], ["--model", "claude-sonnet-5-other"]]) {
    expect(() => parseGuidanceArguments([...base, "--additional-budget-usd", "10", ...extra])).toThrow();
  }
});
