import { expect, test } from "bun:test";
import { createReconciliationContext } from "./context";
import { contextWithRule, storedRule } from "./assessments.fixtures";
import { applyReconciliation } from "./apply";

const repository = { originDirectory: "github.com--synthetic", repositoryName: "palettes" };
const repositoryText = "Generate palette exports with the repository command.";
const globalText = "Keep sentences short.";

function scopedContext(repositoryName: string | null) {
  return createReconciliationContext({
    batch: {
      origin: {
        id: "github.com/synthetic",
        directoryName: repository.originDirectory,
        promotable: true,
      },
      repositoryName,
      signals: [],
    },
    profile: { rules: [], rejections: [] },
    library: { guidance: [], preferences: [], skills: [], axes: [], independentSkills: [] },
    coverage: [
      { source: "personal instructions", text: globalText },
      { source: "repository instructions", text: repositoryText, repository },
    ],
  });
}

test("repository instructions cover only evidence from their own repository", () => {
  expect(scopedContext("palettes").coverage.map(({ text }) => text)).toEqual([
    globalText,
    repositoryText,
  ]);
  expect(scopedContext("billing").coverage.map(({ text }) => text)).toEqual([globalText]);
  expect(scopedContext(null).coverage.map(({ text }) => text)).toEqual([globalText]);
});

test("repository coverage cannot suppress a new global preference", () => {
  const base = contextWithRule(storedRule());
  const text = "Use complete parameter names.";
  const context = {
    ...base,
    rules: [],
    coverage: [
      {
        token: "covered-1",
        source: "repository instructions",
        text,
        repository: {
          originDirectory: base.batch.origin.directoryName,
          repositoryName: base.batch.repositoryName ?? "current",
        },
      },
    ],
  };
  const apply = (scope: "global" | "repository") =>
    applyReconciliation({
      context,
      output: {
        existingRules: [],
        newRules: [
          {
            title: "Use complete parameter names",
            body: text,
            section: "workflow",
            observed: "Explicit instruction",
            evidenceTokens: ["evidence-1"],
            rejectionToken: "covered-1",
          },
        ],
        assessments: [
          {
            evidenceToken: "evidence-1",
            intent: "preference",
            durable: true,
            explicit: true,
            scope,
          },
        ],
      },
    });
  expect(apply("global").rules.map((rule) => rule.scope)).toEqual(["global"]);
  expect(apply("repository").rules).toEqual([]);
});

test("oversized coverage stops reconciliation before it proposes rules", () => {
  expect(() =>
    createReconciliationContext({
      batch: {
        origin: {
          id: "github.com/synthetic",
          directoryName: repository.originDirectory,
          promotable: true,
        },
        repositoryName: "palettes",
        signals: [],
      },
      profile: { rules: [], rejections: [] },
      library: { guidance: [], preferences: [], skills: [], axes: [], independentSkills: [] },
      coverage: [{ source: "personal instructions", text: "x".repeat(512_001) }],
    }),
  ).toThrow("Learning stopped before proposing rules");
});
