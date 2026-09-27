import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../../../paths";
import { ownedWrite } from "../../../storage";
import { budgetSchema } from "../../transfer/accounting";
import { fingerprint } from "../../transfer/structured";
import { legacySchemaFailure } from "../claudeContract";
import {
  candidateFixture,
  contractFixture,
  guidanceFixture,
} from "../fixtures";
import { receiptSchema } from "../schema";
import {
  guidanceDirectory,
  saveGuidanceReceipt,
  saveGuidanceSuite,
} from "../store";

export async function recoveryFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "guidance-recovery-"));
  const paths = createProjectPaths({
    homeDirectory: root,
    platform: "freebsd",
  });
  const suite = guidanceFixture();

  const receipt = receiptSchema.parse({
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
    deadlineAt: Date.now() - 1000,
    status: "error",
    failure: legacySchemaFailure,
    runs: [{ ...candidateFixture(), arm: "bare" }],
  });

  const budget = budgetSchema.parse({
    version: 1,
    limitUsd: 5,
    spentUsd: 0.262548,
    calls: 2,
    maximumCalls: 28,
    pending: false,
    unknownCost: true,
  });

  const directory = guidanceDirectory({ paths, evalId: receipt.evalId });

  await saveGuidanceSuite({ paths, suite });
  await saveGuidanceReceipt({ paths, receipt });
  await ownedWrite({
    path: path.join(directory, "budget.json"),
    content: JSON.stringify(budget),
  });

  return {
    root,
    directory,
    paths,
    receipt,
    budget,
    proof: contractFixture(),
    failedCliVersion: "2.1.267 (Claude Code)",
  };
}
