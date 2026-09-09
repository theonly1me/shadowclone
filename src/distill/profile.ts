import { createProfileRuleKey } from "../profile";
import type { ProfileRule } from "../profile";
import { profileEvidenceId } from "../profile/evidence";
import type { CorrectionSignal } from "../signal";
import { parseDistilledRules } from "./schema";

export function profileRules(options: {
  readonly value: unknown;
  readonly signals: readonly CorrectionSignal[];
  readonly originRules?: readonly ProfileRule[];
}): readonly ProfileRule[] {
  const [first] = options.signals;
  if (!first) {
    return [];
  }
  const defaultObservations = options.signals.length;
  const defaultSessions = new Set(
    options.signals.map((signal) => signal.sessionId),
  ).size;
  const lastTimestamp = Math.max(
    ...options.signals.map((signal) => signal.timestamp),
  );
  const defaultLastSeen =
    lastTimestamp > 0
      ? new Date(lastTimestamp).toISOString().slice(0, 10)
      : "unknown";

  return parseDistilledRules(options.value).map((rule, index) => {
    const constituent = (rule.sources ?? []).flatMap((index) =>
      options.originRules?.[index] ? [options.originRules[index]] : [],
    );
    const observations =
      constituent.length > 0
        ? constituent.reduce((sum, source) => sum + source.observations, 0)
        : defaultObservations;
    const sessions =
      constituent.length > 0
        ? Math.max(...constituent.map((source) => source.sessions))
        : defaultSessions;
    const lastSeen =
      constituent.length > 0
        ? constituent.map((source) => source.lastSeen).sort().at(-1) ??
          defaultLastSeen
        : defaultLastSeen;
    const origins =
      constituent.length > 0
        ? [...new Set(constituent.flatMap((source) => source.origins))].sort()
        : [first.origin.id];
    const evidence =
      constituent.length > 0
        ? [...new Set(constituent.flatMap((source) => source.evidence.for))]
        : [
            ...new Set(
              options.signals.map((signal) =>
                profileEvidenceId({
                  originId: signal.origin.id,
                  sessionId: signal.sessionId,
                  timestamp: signal.timestamp,
                  kind: signal.kind,
                  category: signal.category,
                }),
              ),
            ),
          ];

    return {
      title: rule.title,
      body: rule.body,
      section: rule.section,
      key:
        constituent[0]?.key ??
        options.originRules?.[index]?.key ??
        createProfileRuleKey(),
      scope: "org",
      originDirectory: first.origin.directoryName,
      source: "mined",
      status: "active",
      proposal: null,
      appliesWhen: [],
      evidence: { for: evidence, against: [] },
      observations,
      lastSeen,
      sessions,
      origins,
    };
  });
}
