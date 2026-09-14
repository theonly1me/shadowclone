import { evaluationArmOrder } from "./arms";
import { initialReceipt } from "./storage";
import { fingerprint } from "./structured";
import type { TransferReceipt } from "./types";

export function evidenceReceipt(directory: string): TransferReceipt {
  const profile = "Use complete names.";
  const commit = fingerprint("frozen evaluation test revision").slice(0, 40);
  const check = { requirement: "Code evidence is complete", verdict: "pass" as const, evidence: "parser.ts", votes: [] };
  const receipt = initialReceipt({
    schemaVersion: 12, evalId: crypto.randomUUID(), suiteId: crypto.randomUUID(),
    repository: directory, baseCommit: commit, context: [],
    profileSnapshot: { kind: "current", fingerprint: fingerprint(profile), ruleCount: 1 },
    tasks: [{
      id: "parser", startingCommit: commit, prompt: "Add a parser and tests.",
      completion: ["Parses the input"],
      preferences: [{ requirement: profile, source: { relativePath: "profile.md", heading: "", line: 1 } }],
      profile, profileFingerprint: fingerprint(profile),
    }],
    engine: "codex", model: "gpt-5.6-sol", reasoningEffort: "medium",
    dependencyMode: "current", repeat: 1, timeoutSeconds: 60,
    maxBudgetUsd: null, dirtyFileCount: 0, preflight: [check],
  });
  return {
    ...receipt,
    runs: evaluationArmOrder.map((arm) => ({
      taskId: "parser", repeat: 0, arm, phase: "evidence", sessionId: arm,
      failure: null, failureStage: null, durationMs: 1, costUsd: null,
      dependencyState: "not-required", observed: JSON.stringify({ candidate: arm, code: "export const parse = (value: string) => value.trim();" }),
      verification: [check], safety: [check], correctness: [], preferences: [],
    })),
  };
}
