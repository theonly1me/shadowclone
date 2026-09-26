import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { evaluationBudget } from "../../transfer/accounting";
import { readGuidanceReceipt } from "../store";
import { recoverSchemaFailure } from "./index";
import { recoveryFixture } from "./fixtures";

test("explicit recovery preserves evidence and accounting and renews the deadline only once", async () => {
  const fixture = await recoveryFixture();
  try {
    const startedAt = Date.now();
    const recovered = await recoverSchemaFailure(fixture);
    expect(recovered.deadlineAt).toBeGreaterThanOrEqual(startedAt + 25 * 60 * 1000);
    expect(recovered.deadlineAt).toBeLessThan(Date.now() + 25 * 60 * 1000 + 1);
    expect(recovered.runs).toEqual(fixture.receipt.runs);
    expect(recovered.evalId).toBe(fixture.receipt.evalId);
    expect(recovered.suite).toEqual(fixture.receipt.suite);
    const budget = await Bun.file(path.join(fixture.directory, "budget.json")).json();
    expect(budget).toEqual({ ...fixture.budget, unknownCost: false });
    const audit = await Bun.file(path.join(fixture.directory, "schema-recovery.json")).json();
    expect(audit.originalReceipt).toEqual(fixture.receipt);
    expect(audit.originalBudget).toEqual(fixture.budget);
    expect(audit.recoveredCostUsd).toBe(0);
    const repeated = await recoverSchemaFailure({ ...fixture, receipt: recovered });
    expect(repeated).toEqual(recovered);
    const ledger = await evaluationBudget({ directory: fixture.directory, resume: true, limitUsd: 5, maximumCalls: 28 });
    expect(await ledger.reserve()).toBeCloseTo(4.737452);
    await ledger.settle(null);
    await recoverSchemaFailure({ ...fixture, receipt: recovered });
    await expect(ledger.reserve()).rejects.toThrow("cost unknown");
    expect((await Bun.file(path.join(fixture.directory, "budget.json")).json()).unknownCost).toBeTrue();
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("an interrupted recovery finishes from its audit without a second renewal", async () => {
  const fixture = await recoveryFixture();
  try {
    const recovered = await recoverSchemaFailure(fixture);
    await Bun.write(path.join(fixture.directory, "guidance-state.json"), JSON.stringify(fixture.receipt));
    const repeated = await recoverSchemaFailure(fixture);
    expect(repeated.deadlineAt).toBe(recovered.deadlineAt);
    expect(await readGuidanceReceipt({ paths: fixture.paths, evalId: fixture.receipt.evalId })).toEqual(recovered);
    expect((await Bun.file(path.join(fixture.directory, "budget.json")).json()).calls).toBe(2);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("recovery cannot discard another unknown invocation or changed frozen inputs", async () => {
  const fixture = await recoveryFixture();
  try {
    const originalReceipt = await Bun.file(path.join(fixture.directory, "guidance-state.json")).text();
    await expect(recoverSchemaFailure({ ...fixture, receipt: { ...fixture.receipt, failure: "Process timed out" } })).rejects.toThrow("verified local schema");
    await expect(recoverSchemaFailure({ ...fixture, failedCliVersion: "different" })).rejects.toThrow("CLI version");
    await expect(recoverSchemaFailure({ ...fixture, proof: { ...fixture.proof, currentSchemaFingerprint: "changed" } })).rejects.toThrow("current judge schemas");
    await expect(recoverSchemaFailure({ ...fixture, receipt: { ...fixture.receipt, suite: { ...fixture.receipt.suite, profile: "changed" } } })).rejects.toThrow("frozen sources");
    await Bun.write(path.join(fixture.directory, "budget.json"), JSON.stringify({ ...fixture.budget, calls: 3 }));
    await expect(recoverSchemaFailure(fixture)).rejects.toThrow("exactly one");
    expect(await Bun.file(path.join(fixture.directory, "guidance-state.json")).text()).toBe(originalReceipt);
    expect(await Bun.file(path.join(fixture.directory, "schema-recovery.json")).exists()).toBeFalse();
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("an existing recovery cannot change model, budget, sources, or saved candidate evidence", async () => {
  const fixture = await recoveryFixture();
  try {
    const recovered = await recoverSchemaFailure(fixture);
    for (const replacement of [
      { ...recovered, model: "different" },
      { ...recovered, limitUsd: 6 },
      { ...recovered, maximumCalls: 29 },
      { ...recovered, suite: { ...recovered.suite, profile: "changed" } },
      { ...recovered, runs: recovered.runs.map((candidate) => ({ ...candidate, evidence: "changed" })) },
    ]) await expect(recoverSchemaFailure({ ...fixture, receipt: replacement })).rejects.toThrow("frozen inputs changed");
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
