import { expect, test } from "bun:test";
import { reviewResultSchema, type ReviewResult } from "@shadowclone/review";
import { reviewFileContent } from "./reviewFile";

const result: ReviewResult = {
  version: 1,
  pull: {
    repository: "local/project",
    number: null,
    title: "t",
    body: "",
    baseRefName: "main",
    baseSha: "a".repeat(40),
    headSha: "b".repeat(40),
  },
  model: "claude-opus-5-5",
  findings: [
    {
      path: "src/order.ts",
      line: 12,
      severity: "high",
      category: "correctness",
      source: "investigation",
      title: "Total skips the discount",
      explanation: "The total ignores the discount.",
      failureScenario: "A 10% coupon charges the full price.",
      evidence: [{ source: "code", location: "src/order.ts:12", quote: "return subtotal;" }],
      rule: null,
      suggestion: null,
      refutation: "No other path applies the discount.",
      candidates: [],
    },
  ],
  commentableLines: {},
  skippedPaths: [],
  toolchain: [],
  dropped: [],
  candidates: { dropped: [], undecided: [] },
  rejections: [],
  statistics: {
    modelFindings: 1,
    droppedForEvidence: 0,
    correctionRound: "none",
    certainRuleHits: 0,
    signalRuleHits: 0,
    durationMilliseconds: 40_000,
    costUsd: 0.42,
    parts: 1,
  },
};

test("a review written to a .json file is the full review result, so other tools can read each finding", () => {
  const written = reviewResultSchema.parse(
    JSON.parse(reviewFileContent({ result, file: "/tmp/review.JSON" })),
  );

  expect(written.findings.map((finding) => `${finding.path}:${finding.line}`)).toEqual([
    "src/order.ts:12",
  ]);
  expect(written.statistics.costUsd).toBe(0.42);
});

test("a review written to any other file is Markdown", () => {
  expect(reviewFileContent({ result, file: "/tmp/review.md" })).toStartWith(
    "# Review of local/project",
  );
});
