import { expect, test } from "bun:test";
import { parseDiff } from "./collect/diff";
import type { ReviewPacket } from "./packet";
import { reviewResult } from "./result";
import type { RuleHit } from "./rules";
import type { Finding } from "./types";

const files = parseDiff(
  ["diff --git a/src/keys.ts b/src/keys.ts", "--- a/src/keys.ts", "+++ b/src/keys.ts", "@@ -1 +1,2 @@", " export const a = 1;", "+export const key = read();", ""].join("\n"),
);

function packet(ruleHits: readonly RuleHit[]): ReviewPacket {
  return {
    context: {
      facts: { repository: "example/project", number: 3, title: "t", body: "", baseRefName: "main", baseSha: "a".repeat(40), headSha: "b".repeat(40) },
      files,
      standards: { documents: [], omitted: [] },
      history: "",
    },
    ruleHits,
    toolchain: [],
  };
}

const certainHit: RuleHit = {
  ruleId: "credential-github-token",
  level: "certain",
  severity: "high",
  category: "security",
  title: "Credential committed",
  failure: "Anyone who can read the repository can use it.",
  path: "src/keys.ts",
  line: 2,
};

function modelFinding(line: number): Finding {
  return {
    path: "src/other.ts",
    line,
    severity: "low",
    category: "correctness",
    source: "investigation",
    title: `Finding ${line}`,
    explanation: "e",
    failureScenario: "f",
    evidence: [{ source: "code", location: `src/other.ts:${line}`, quote: "x" }],
    rule: null,
    suggestion: null,
    refutation: "r",
  };
}

test("a certain rule hit is reported even when the model returns nothing", () => {
  const result = reviewResult({ packet: packet([certainHit]), modelFindings: [], dropped: [], model: "m", costUsd: null, startedAt: Date.now() });

  expect(result.findings.map((finding) => [finding.source, finding.path, finding.line])).toEqual([["rule", "src/keys.ts", 2]]);
});

test("a signal rule hit is not reported without the model", () => {
  const result = reviewResult({ packet: packet([{ ...certainHit, level: "signal" }]), modelFindings: [], dropped: [], model: "m", costUsd: null, startedAt: Date.now() });

  expect(result.findings).toEqual([]);
  expect(result.statistics.signalRuleHits).toBe(1);
});

test("a certain finding survives the cap when the model returns many low findings", () => {
  const many = Array.from({ length: 15 }, (_, index) => modelFinding(index * 10 + 1));
  const result = reviewResult({ packet: packet([certainHit]), modelFindings: many, dropped: [], model: "m", costUsd: null, startedAt: Date.now() });

  expect(result.findings).toHaveLength(10);
  expect(result.findings[0]?.source).toBe("rule");
});
