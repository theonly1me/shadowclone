import {
  profileEvidenceStatistics,
  type ProfileProposal,
  type ProfileRule,
} from "../../profile";
import type {
  AppliedReconciliation,
  PromptRule,
  ReconciliationContext,
  ReconciliationExistingRule,
  ReconciliationOutput,
} from "./types";

function union(values: readonly string[], additions: readonly string[]): readonly string[] {
  return [...new Set([...values, ...additions])];
}

function evidenceIds(options: {
  readonly tokens: readonly string[];
  readonly context: ReconciliationContext;
}): readonly string[] {
  const allowed = new Map(
    options.context.evidence.map((entry) => [entry.token, entry.evidenceId]),
  );
  return [...new Set(options.tokens.flatMap((token) => {
    const evidenceId = allowed.get(token);
    return evidenceId ? [evidenceId] : [];
  }))];
}

function proposal(options: {
  readonly result: ReconciliationExistingRule;
  readonly promptRule: PromptRule;
}): ProfileProposal | null {
  const axis = options.promptRule.axisOptions.find(
    (entry) => entry.token === options.result.axisChoiceToken,
  );
  const title = axis?.title ?? options.result.proposedTitle;
  const body = axis?.body ?? options.result.proposedBody;
  if (!title || !body) {
    return options.promptRule.snapshot.rule.proposal;
  }
  return {
    kind: options.result.verdict === "narrows" ? "narrow" : "revise",
    text: axis
      ? `${title}\n\n${body}\n\nApplies when: ${axis.appliesWhen.join(", ")}`
      : `${title}\n\n${body}`,
  };
}

function applyExisting(options: {
  readonly result: ReconciliationExistingRule;
  readonly promptRule: PromptRule;
  readonly context: ReconciliationContext;
}): ProfileRule | null {
  const additions = evidenceIds({
    tokens: options.result.evidenceTokens,
    context: options.context,
  });
  if (additions.length === 0) {
    return null;
  }
  const current = options.promptRule.snapshot.rule;
  const reinforces = options.result.verdict === "reinforces";
  const evidence = {
    for: reinforces ? union(current.evidence.for, additions) : current.evidence.for,
    against: reinforces
      ? current.evidence.against
      : union(current.evidence.against, additions),
  };
  const statistics = profileEvidenceStatistics({ rule: current, evidence });
  const status = current.source !== "mined"
    ? "active" as const
    : options.result.verdict !== "reinforces"
      ? "stale" as const
      : statistics.sessions >= 3
        ? "active" as const
        : "candidate" as const;
  return {
    ...current,
    ...statistics,
    evidence,
    status,
    proposal: reinforces
      ? current.proposal
      : proposal({ result: options.result, promptRule: options.promptRule }),
  };
}

function emptyMinedRule(options: {
  readonly result: ReconciliationOutput["newRules"][number];
  readonly context: ReconciliationContext;
  readonly evidence: readonly string[];
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
  const base: ProfileRule = {
    key: `mined:${key}`,
    title: options.result.title,
    body: options.result.body,
    section: options.result.section,
    scope: "org",
    originDirectory: options.context.batch.origin.directoryName,
    repositoryName: null,
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
    status: statistics.sessions >= 3 ? "active" : "candidate",
  };
}

export function applyReconciliation(options: {
  readonly output: ReconciliationOutput;
  readonly context: ReconciliationContext;
}): AppliedReconciliation {
  const promptRules = new Map(options.context.rules.map((entry) => [entry.token, entry]));
  const rules: ProfileRule[] = [];
  const changes: AppliedReconciliation["changes"][number][] = [];
  for (const result of options.output.existingRules) {
    const promptRule = promptRules.get(result.ruleToken);
    if (!promptRule) {
      continue;
    }
    const after = applyExisting({ result, promptRule, context: options.context });
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
  const rejectionTokens = new Set(options.context.rejections.map((entry) => entry.token));
  let rejectedMatches = 0;
  for (const result of options.output.newRules) {
    if (result.rejectionToken && rejectionTokens.has(result.rejectionToken)) {
      rejectedMatches += 1;
      continue;
    }
    const evidence = evidenceIds({ tokens: result.evidenceTokens, context: options.context });
    if (evidence.length === 0) {
      continue;
    }
    const after = emptyMinedRule({ result, context: options.context, evidence });
    rules.push(after);
    changes.push({ kind: "new", observed: result.observed, before: null, after });
  }
  return { rules, changes, rejectedMatches };
}
