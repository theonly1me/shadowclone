import type {
  CorpusSummary,
  IndexedEvent,
} from "../index";
import { mineCorrections } from "./corrections";
import { isOriginBlocked } from "./blockedOrigin";
import {
  getEventRepository,
  resolveEventRepositories,
} from "./origin";
import type { GitRemoteReader } from "./origin";
import { countSignals, deriveStructural } from "./structural";
import type {
  CorrectionSignal,
  CountedCategory,
  OriginScope,
  StructuralSummary,
} from "./types";

export type MirrorReport = {
  readonly corpus: CorpusSummary;
  readonly originCount: number;
  readonly correctionCounts: {
    readonly interruptions: number;
    readonly permissionDenials: number;
    readonly answeredQuestions: number;
    readonly resolvedPlans: number;
  };
  readonly interruptions: readonly CountedCategory[];
  readonly denials: readonly CountedCategory[];
  readonly askedQuestions: number;
  readonly presentedPlans: number;
  readonly structural: StructuralSummary;
};

export type DerivedSignals = {
  readonly corrections: readonly CorrectionSignal[];
  readonly events: readonly IndexedEvent[];
  readonly origins: ReadonlyMap<string, OriginScope>;
  readonly report: MirrorReport;
};

export type {
  CorrectionSignal,
  CorrectionSignalKind,
  CountedCategory,
  OriginScope,
  RepositoryIdentity,
  StructuralSummary,
} from "./types";
export { isOriginBlocked } from "./blockedOrigin";
export {
  getEventOrigin,
  getEventRepository,
  normalizeRemoteOrigin,
  normalizeRemoteRepository,
  readGitRemote,
  resolveCwdOrigin,
  resolveEventRepositories,
  resolveRepository,
  type GitRemoteReader,
} from "./origin";
export {
  checkMarkerStaleness,
  computeSourceHealth,
  type SourceMarkerHealth,
} from "./health";

function countKind(
  events: readonly IndexedEvent[],
  kind: IndexedEvent["kind"],
): number {
  return events.filter((event) => event.kind === kind).length;
}

export async function deriveSignals(options: {
  readonly events: readonly IndexedEvent[];
  readonly corpus: CorpusSummary;
  readonly gitMetadataEnabled: boolean;
  readonly readRemote?: GitRemoteReader;
  readonly blockedOrigins?: readonly string[];
}): Promise<DerivedSignals> {
  const repositories = await resolveEventRepositories({
    events: options.events,
    enabled: options.gitMetadataEnabled,
    readRemote: options.readRemote,
  });
  const events = options.events.filter((event) =>
    !isOriginBlocked({
      repository: getEventRepository({ event, repositories }),
      patterns: options.blockedOrigins ?? [],
    })
  );
  const origins = new Map(
    [...repositories].map(([key, repository]) => [key, repository.origin]),
  );
  const corrections = mineCorrections({ events, origins });
  const interruptions = corrections.filter(
    (signal) => signal.kind === "interruption",
  );
  const denials = corrections.filter(
    (signal) => signal.kind === "permission-denied",
  );
  const answeredQuestions = corrections.filter(
    (signal) => signal.kind === "question-answered",
  );
  const resolvedPlans = corrections.filter(
    (signal) => signal.kind === "plan-resolved",
  );
  const originCount = new Set(
    events.map(
      (event) => getEventRepository({ event, repositories }).origin.id,
    ),
  ).size;

  return {
    corrections,
    events,
    origins,
    report: {
      corpus: options.corpus,
      originCount,
      correctionCounts: {
        interruptions: interruptions.length,
        permissionDenials: denials.length,
        answeredQuestions: answeredQuestions.length,
        resolvedPlans: resolvedPlans.length,
      },
      interruptions: countSignals(interruptions),
      denials: countSignals(denials),
      askedQuestions: countKind(events, "question-asked"),
      presentedPlans: countKind(events, "plan-presented"),
      structural: deriveStructural(events),
    },
  };
}
