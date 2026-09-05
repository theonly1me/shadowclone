import type { IndexedEvent } from "../index";
import { getEventOrigin } from "../signal";
import type {
  CorrectionSignal,
  OriginScope,
} from "../signal";
import type {
  ProfileRule,
  ProfileSection,
} from "./types";

type RuleObservation = {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly section: ProfileSection;
  readonly origin: OriginScope;
  readonly timestamp: number;
  readonly sessionId: string;
  readonly opportunities: number;
};

function stableKey(value: string): string {
  return new Bun.CryptoHasher("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

function signalText(signal: CorrectionSignal): {
  readonly title: string;
  readonly body: string;
  readonly section: ProfileSection;
} {
  if (signal.kind === "interruption") {
    return {
      title: `Stops the agent ${signal.label}`,
      body: `Pause and reassess when work reaches this pattern: ${signal.label}.`,
      section: "workflow",
    };
  }
  if (signal.kind === "permission-denied") {
    return {
      title: `Requests confirmation after refusing ${signal.label}`,
      body: `A \`${signal.label}\` request was refused. Ask before repeating a similar action, but do not treat the whole tool family as blocked.`,
      section: "boundaries",
    };
  }
  if (signal.kind === "question-answered") {
    return {
      title: "Answers agent questions before work continues",
      body: "Ask a focused question when a consequential choice is unresolved.",
      section: "workflow",
    };
  }
  return {
    title: "Reviews presented plans",
    body: "Present the plan and wait for its resolution before implementation.",
    section: "workflow",
  };
}

function signalObservations(
  signals: readonly CorrectionSignal[],
): readonly RuleObservation[] {
  const totals = Map.groupBy(
    signals,
    (signal) => `${signal.origin.id}:${signal.kind}`,
  );
  return signals.map((signal) => {
    const text = signalText(signal);
    return {
      key: stableKey(`${signal.kind}:${signal.category}`),
      ...text,
      origin: signal.origin,
      timestamp: signal.timestamp,
      sessionId: signal.sessionId,
      opportunities:
        totals.get(`${signal.origin.id}:${signal.kind}`)?.length ?? 1,
    };
  });
}

function structuralObservations(options: {
  readonly events: readonly IndexedEvent[];
  readonly origins: ReadonlyMap<string, OriginScope>;
}): readonly RuleObservation[] {
  const toolEvents = options.events.filter((event) => event.tool !== null);
  const totals = Map.groupBy(toolEvents, (event) =>
    getEventOrigin({ event, origins: options.origins }).id
  );
  return toolEvents.map((event) => {
    const origin = getEventOrigin({ event, origins: options.origins });
    const toolName = event.tool?.name ?? "unknown";
    return {
      key: stableKey(`tool-use:${toolName}`),
      title: `Uses ${toolName} in agent sessions`,
      body: `The \`${toolName}\` tool is part of the regular workflow.`,
      section: "engineering",
      origin,
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      opportunities: totals.get(origin.id)?.length ?? 1,
    };
  });
}

function aggregateRule(options: {
  readonly observations: readonly RuleObservation[];
  readonly scope: ProfileRule["scope"];
}): ProfileRule {
  const [first] = options.observations;
  if (!first) {
    throw new Error("Cannot aggregate an empty rule");
  }
  const sessions = new Set(
    options.observations.map((observation) => observation.sessionId),
  );
  const origins = [
    ...new Set(
      options.observations.map((observation) => observation.origin.id),
    ),
  ].sort();
  const lastSeenTimestamp = Math.max(
    ...options.observations.map((observation) => observation.timestamp),
  );
  const opportunities = Math.max(
    ...options.observations.map((observation) => observation.opportunities),
  );

  return {
    key: first.key,
    title: first.title,
    body: first.body,
    section: first.section,
    scope: options.scope,
    originDirectory:
      options.scope === "org" ? first.origin.directoryName : null,
    observations: options.observations.length,
    confidence: Math.min(1, options.observations.length / opportunities),
    lastSeen:
      lastSeenTimestamp > 0
        ? new Date(lastSeenTimestamp).toISOString().slice(0, 10)
        : "unknown",
    sessions: sessions.size,
    origins,
  };
}

export function buildProfileRules(options: {
  readonly events: readonly IndexedEvent[];
  readonly signals: readonly CorrectionSignal[];
  readonly origins: ReadonlyMap<string, OriginScope>;
}): readonly ProfileRule[] {
  const observations = [
    ...signalObservations(options.signals),
    ...structuralObservations(options),
  ];
  const rules: ProfileRule[] = [];

  for (const matching of Map.groupBy(observations, (value) => value.key).values()) {
    const promotableOrigins = new Set(
      matching
        .filter((value) => value.origin.promotable)
        .map((value) => value.origin.id),
    );
    if (promotableOrigins.size >= 2) {
      rules.push(
        aggregateRule({
          observations: matching.filter((value) => value.origin.promotable),
          scope: "global",
        }),
      );
    }

    const local = Map.groupBy(
      matching.filter(
        (value) => !value.origin.promotable || promotableOrigins.size < 2,
      ),
      (value) => value.origin.id,
    );
    for (const scoped of local.values()) {
      rules.push(aggregateRule({ observations: scoped, scope: "org" }));
    }
  }

  return rules.sort(
    (left, right) =>
      right.observations - left.observations ||
      left.title.localeCompare(right.title),
  );
}
