import {
  isExplicitProfileEvidence,
  profileEvidenceStatistics,
  type ProfileRule,
} from "../../profile";
import {
  assessedContext,
  explicitEvidenceTokens,
  globalEvidenceTokens,
} from "./assessments";
import { materializeEvidenceIds, unionEvidence } from "./evidence";
import { reconciliationProposal } from "./proposal";
import {
  assessedScopePromotions,
  learnedRuleLocation,
  promoteGlobalRule,
} from "./scope";
import type {
  AppliedReconciliation,
  PromptRule,
  ReconciliationContext,
  ReconciliationExistingRule,
  ReconciliationOutput,
} from "./types";
function applyExisting(options: {
  readonly result: ReconciliationExistingRule;
  readonly promptRule: PromptRule;
  readonly context: ReconciliationContext;
  readonly explicitTokens: ReadonlySet<string>;
  readonly globalTokens: ReadonlySet<string>;
}): ProfileRule | null {
  const additions = materializeEvidenceIds({
    tokens: options.result.evidenceTokens,
    context: options.context,
    explicitTokens: options.explicitTokens,
  });
  if (additions.length === 0) {
    return null;
  }
  const current = options.promptRule.snapshot.rule;
  const reinforces = options.result.verdict === "reinforces";
  const evidence = {
    for: reinforces
      ? unionEvidence(current.evidence.for, additions)
      : current.evidence.for,
    against: reinforces
      ? current.evidence.against
      : unionEvidence(current.evidence.against, additions),
  };
  const statistics = profileEvidenceStatistics({ rule: current, evidence });
  const status = current.source !== "mined"
    ? "active" as const
    : options.result.verdict !== "reinforces"
      ? "stale" as const
      : evidence.for.some(isExplicitProfileEvidence) || statistics.sessions >= 3
        ? "active" as const
        : "candidate" as const;
  const updated: ProfileRule = {
    ...current,
    ...statistics,
    evidence,
    status,
    proposal: reinforces
      ? current.proposal
      : reconciliationProposal({
          result: options.result,
          promptRule: options.promptRule,
        }),
  };
  return promoteGlobalRule({
    rule: updated,
    tokens: options.result.evidenceTokens,
    context: options.context,
    globalTokens: options.globalTokens,
  });
}
function emptyMinedRule(options: {
  readonly result: ReconciliationOutput["newRules"][number];
  readonly context: ReconciliationContext;
  readonly evidence: readonly string[];
  readonly globalTokens: ReadonlySet<string>;
}): ProfileRule {
  const [first] = options.context.evidence;
  const key = new Bun.CryptoHasher("sha256")
    .update(JSON.stringify({
      origin: options.context.batch.origin.id,
      title: options.result.title,
      body: options.result.body,
      section: options.result.section,
      evidence: options.evidence,
    }))
    .digest("hex")
    .slice(0, 24);
  const location = learnedRuleLocation({
    tokens: options.result.evidenceTokens,
    context: options.context,
    globalTokens: options.globalTokens,
  });
  const base: ProfileRule = {
    key: `mined:${key}`,
    title: options.result.title,
    body: options.result.body,
    section: options.result.section,
    ...location,
    source: "mined",
    status: "candidate",
    proposal: null,
    appliesWhen: [],
    evidence: { for: options.evidence, against: [] },
    observations: 0,
    sessions: 0,
    origins: first ? [first.signal.origin.id] : [],
    lastSeen: "unknown",
    importReference: null,
  };
  const statistics = profileEvidenceStatistics({ rule: base, evidence: base.evidence });
  return {
    ...base,
    ...statistics,
    status: options.evidence.some(isExplicitProfileEvidence) ||
      statistics.sessions >= 3
      ? "active"
      : "candidate",
  };
}

export function applyReconciliation(options: {
  readonly output: ReconciliationOutput;
  readonly context: ReconciliationContext;
}): AppliedReconciliation {
  const explicitTokens = explicitEvidenceTokens(options.output);
  const globalTokens = globalEvidenceTokens(options.output);
  options = { ...options, context: assessedContext(options) };
  const promptRules = new Map(options.context.rules.map((entry) => [entry.token, entry]));
  const rules: ProfileRule[] = [];
  const changes: AppliedReconciliation["changes"][number][] = [];
  for (const result of options.output.existingRules) {
    const promptRule = promptRules.get(result.ruleToken);
    if (!promptRule) {
      continue;
    }
    const after = applyExisting({
      result,
      promptRule,
      context: options.context,
      explicitTokens,
      globalTokens,
    });
    if (!after) {
      continue;
    }
    rules.push(after);
    changes.push({
      kind: result.verdict,
      observed: result.observed,
      before: promptRule.snapshot.rule,
      after,
    });
  }
  const updatedKeys = new Set(rules.map((rule) => rule.key));
  for (const { before, after } of assessedScopePromotions({
      rules: options.context.rules,
      context: options.context,
      globalTokens,
      excludedKeys: updatedKeys,
    })) {
    rules.push(after);
    changes.push({
      kind: "scope",
      observed: "The explicit preference applies across repositories.",
      before,
      after,
    });
  }
  const rejectionTokens = new Set(options.context.rejections.map((entry) => entry.token));
  let rejectedMatches = 0;
  for (const result of options.output.newRules) {
    if (result.rejectionToken && rejectionTokens.has(result.rejectionToken)) {
      rejectedMatches += 1;
      continue;
    }
    const evidence = materializeEvidenceIds({
      tokens: result.evidenceTokens,
      context: options.context,
      explicitTokens,
    });
    if (evidence.length === 0) {
      continue;
    }
    const after = emptyMinedRule({
      result,
      context: options.context,
      evidence,
      globalTokens,
    });
    rules.push(after);
    changes.push({ kind: "new", observed: result.observed, before: null, after });
  }
  return { rules, changes, rejectedMatches };
}
