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
      mergeBaseSha: "a".repeat(40),
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
    candidates: [],
  };
}


function resultFor(options: { readonly hits: readonly RuleHit[]; readonly findings: readonly Finding[] }) {
  return reviewResult({
    packet: packet(options.hits),
    analysis: { findings: [...options.findings], dropped: [] },
    gate: { kept: options.findings, dropped: [] },
    dispositions: { problems: [], dropped: [], undecided: [] },
    candidates: [],
    model: "m",
    costUsd: null,
    correctionRound: "none",
    rejections: [],
    startedAt: Date.now(),
    parts: 1,
  });
}

test("a certain rule hit is reported even when the model returns nothing", () => {
  const result = resultFor({ hits: [certainHit], findings: [] });

  expect(result.findings.map((finding) => [finding.source, finding.path, finding.line])).toEqual([["rule", "src/keys.ts", 2]]);
});

test("a signal rule hit is not reported without the model", () => {
  const result = resultFor({ hits: [{ ...certainHit, level: "signal" }], findings: [] });

  expect(result.findings).toEqual([]);
  expect(result.statistics.signalRuleHits).toBe(1);
});

test("a certain finding survives the cap when the model returns many low findings", () => {
  const many = Array.from({ length: 15 }, (_, index) => modelFinding(index * 10 + 1));
  const result = resultFor({ hits: [certainHit], findings: many });

  expect(result.findings).toHaveLength(10);
  expect(result.findings[0]?.source).toBe("rule");
});

test("every high severity finding survives the cap, and the cap still limits the rest", () => {
  const high = Array.from({ length: 12 }, (_, index) => ({ ...modelFinding(index * 10 + 1), severity: "high" as const }));
  const low = Array.from({ length: 5 }, (_, index) => modelFinding(index * 10 + 500));
  const result = resultFor({ hits: [], findings: [...low, ...high] });

  expect(result.findings).toHaveLength(12);
  expect(result.findings.every((finding) => finding.severity === "high")).toBe(true);
});

test("high severity findings stop at 25, the limit of a posted review", () => {
  const high = Array.from({ length: 30 }, (_, index) => ({ ...modelFinding(index * 10 + 1), severity: "high" as const }));

  expect(resultFor({ hits: [], findings: high }).findings).toHaveLength(25);
});

test("low linter findings stay past the cap and leave the model its 10 places", () => {
  const linterHit = (line: number): RuleHit => ({ ...certainHit, ruleId: "hadolint", severity: "low", category: "correctness", title: `hadolint: ${line}`, line });
  const model = Array.from({ length: 12 }, (_, index) => modelFinding(index * 10 + 1));
  const result = resultFor({ hits: [linterHit(2), { ...linterHit(2), path: "Dockerfile" }, { ...linterHit(9), path: "deploy.sh" }], findings: model });

  expect(result.findings.filter((finding) => finding.source === "rule")).toHaveLength(3);
  expect(result.findings.filter((finding) => finding.source === "investigation")).toHaveLength(10);
});

test("linter findings on neighbouring lines of one file are separate findings", () => {
  const hadolint = (line: number): RuleHit => ({ ...certainHit, ruleId: "hadolint", severity: "low", category: "correctness", title: `hadolint ${line}`, path: "Dockerfile", line });
  const result = resultFor({ hits: [hadolint(1), hadolint(2), hadolint(3), hadolint(4)], findings: [] });

  expect(result.findings.map((finding) => finding.line)).toEqual([1, 2, 3, 4]);
});
