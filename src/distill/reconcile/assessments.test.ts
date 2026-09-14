import { expect, test } from "bun:test";
import {
  explicitProfileEvidence,
  profileEvidenceId,
  type ProfileRule,
} from "../../profile";
import { applyReconciliation } from "./apply";
import { createReconciliationContext } from "./context";
import type { ReconciliationOutput } from "./types";

const origin = { id: "local", directoryName: "local", promotable: false };
const context = createReconciliationContext({
  batch: { origin, repositoryName: "current", signals: [1, 2, 3].map((session) => ({ kind: "user-steering" as const, origin, category: "user-episode", label: "user episode", timestamp: session, sessionId: `session-${session}`, repositoryName: "current", textRefs: [] })) },
  profile: { rules: [], rejections: [] },
  library: { guidance: [], preferences: [], skills: [], axes: [], independentSkills: [] },
});
const newRule = { title: "Use complete names", body: "Use complete variable names.", section: "engineering" as const, observed: "Repeated user preference", evidenceTokens: ["evidence-1", "evidence-2", "evidence-3"], rejectionToken: "" };
type Intent = NonNullable<ReconciliationOutput["assessments"]>[number]["intent"];

function storedRule(evidence: readonly string[] = []): ProfileRule {
  return {
    key: "existing-rule",
    title: newRule.title,
    body: newRule.body,
    section: newRule.section,
    scope: "project",
    originDirectory: origin.directoryName,
    repositoryName: "current",
    source: "mined",
    status: "candidate",
    proposal: null,
    appliesWhen: [],
    evidence: { for: evidence, against: [] },
    observations: evidence.length,
    sessions: evidence.length,
    origins: evidence.length > 0 ? [origin.id] : [],
    lastSeen: evidence.length > 0 ? "1970-01-01" : "unknown",
    importReference: null,
  };
}

function contextWithRule(rule: ProfileRule) {
  return createReconciliationContext({
    batch: context.batch,
    profile: {
      rules: [{
        rule,
        promptTitle: rule.title,
        promptBody: rule.body,
        promptAppliesWhen: [],
        promptProposal: null,
      }],
      rejections: [],
    },
    library: {
      guidance: [], preferences: [], skills: [], axes: [], independentSkills: [],
    },
  });
}

test.each(["additional-context", "cancellation", "unknown"] as const)("%s cannot activate a preference even when the model proposes one", (intent: Intent) => {
  const output = { existingRules: [], newRules: [newRule], assessments: newRule.evidenceTokens.map((evidenceToken) => ({ evidenceToken, intent, durable: true, scope: "repository" as const })) };
  expect(applyReconciliation({ context, output }).rules).toEqual([]);
});

test.each(["preference", "correction", "approval"] as const)("durable %s supports a repository-scoped rule", (intent: Intent) => {
  const output = { existingRules: [], newRules: [newRule], assessments: newRule.evidenceTokens.map((evidenceToken) => ({ evidenceToken, intent, durable: true, scope: "repository" as const })) };
  const [rule] = applyReconciliation({ context, output }).rules;
  expect(rule?.status).toBe("active");
  expect(rule?.scope).toBe("project");
  expect(rule?.repositoryName).toBe("current");
});

test("missing, temporary and duplicate assessments cannot add evidence", () => {
  for (const assessments of [undefined, newRule.evidenceTokens.map((evidenceToken) => ({ evidenceToken, intent: "correction" as const, durable: false, scope: "repository" as const })), [1, 2].map(() => ({ evidenceToken: "evidence-1", intent: "preference" as const, durable: true, scope: "repository" as const }))]) {
    expect(applyReconciliation({ context, output: { existingRules: [], newRules: [newRule], assessments } }).rules).toEqual([]);
  }
});

test("one explicit reusable instruction activates while one inference waits", () => {
  const singleRule = { ...newRule, evidenceTokens: ["evidence-1"] };
  const explicit = applyReconciliation({
    context,
    output: {
      existingRules: [],
      newRules: [singleRule],
      assessments: [{
        evidenceToken: "evidence-1",
        intent: "preference",
        durable: true,
        explicit: true,
        scope: "global",
      }],
    },
  });
  const inferred = applyReconciliation({
    context,
    output: {
      existingRules: [],
      newRules: [singleRule],
      assessments: [{
        evidenceToken: "evidence-1",
        intent: "preference",
        durable: true,
        explicit: false,
        scope: "global",
      }],
    },
  });
  expect(explicit.rules[0]?.status).toBe("active");
  expect(explicit.rules[0]?.scope).toBe("global");
  expect(inferred.rules[0]?.status).toBe("candidate");
  expect(inferred.rules[0]?.scope).toBe("project");
});

test("explicit global guidance promotes an existing mined repository rule", () => {
  const applied = applyReconciliation({
    context: contextWithRule(storedRule()),
    output: {
      existingRules: [{
        ruleToken: "rule-1",
        verdict: "reinforces",
        observed: "The user stated a personal preference.",
        evidenceTokens: ["evidence-1"],
        proposedTitle: "",
        proposedBody: "",
        axisChoiceToken: "",
      }],
      newRules: [],
      assessments: [{
        evidenceToken: "evidence-1",
        intent: "preference",
        durable: true,
        explicit: true,
        scope: "global",
      }],
    },
  });

  expect(applied.rules[0]?.scope).toBe("global");
  expect(applied.rules[0]?.originDirectory).toBeNull();
  expect(applied.rules[0]?.repositoryName).toBeNull();
});

test("a global assessment relocates matching stored evidence without a duplicate rule", () => {
  const evidence = explicitProfileEvidence(profileEvidenceId({
    originId: origin.id,
    sessionId: "session-1",
    timestamp: 1,
    kind: "user-steering",
    category: "user-episode",
  }));
  const applied = applyReconciliation({
    context: contextWithRule(storedRule([evidence])),
    output: {
      existingRules: [],
      newRules: [],
      assessments: [{
        evidenceToken: "evidence-1",
        intent: "preference",
        durable: true,
        explicit: true,
        scope: "global",
      }],
    },
  });

  expect(applied.rules[0]?.scope).toBe("global");
  expect(applied.changes[0]?.kind).toBe("scope");
});
