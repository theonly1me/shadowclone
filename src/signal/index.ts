import type {
  CorpusSummary,
  IndexedEvent,
} from "../index";
import { mineCorrections } from "./corrections";
import {
  getEventOrigin,
  isOriginBlocked,
  resolveEventOrigins,
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
  readonly interruptions: readonly CountedCategory[];
  readonly denials: readonly CountedCategory[];
  readonly answeredQuestions: number;
  readonly askedQuestions: number;
  readonly resolvedPlans: number;
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
export {
  getEventOrigin,
  isOriginBlocked,
  normalizeRemoteOrigin,
  normalizeRemoteRepository,
  readGitRemote,
  resolveCwdOrigin,
  resolveEventOrigins,
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
  const origins = await resolveEventOrigins({
    events: options.events,
    enabled: options.gitMetadataEnabled,
    readRemote: options.readRemote,
  });
  const events = options.events.filter((event) =>
    !isOriginBlocked({
      origin: getEventOrigin({ event, origins }),
      cwd: event.cwd,
      patterns: options.blockedOrigins ?? [],
    })
  );
  const corrections = mineCorrections({ events, origins });
  const interruptions = corrections.filter(
    (signal) => signal.kind === "interruption",
  );
  const denials = corrections.filter(
    (signal) => signal.kind === "permission-denied",
  );

  return {
    corrections,
    events,
    origins,
    report: {
      corpus: options.corpus,
      interruptions: countSignals(interruptions),
      denials: countSignals(denials),
      answeredQuestions: corrections.filter(
        (signal) => signal.kind === "question-answered",
      ).length,
      askedQuestions: countKind(events, "question-asked"),
      resolvedPlans: corrections.filter(
        (signal) => signal.kind === "plan-resolved",
      ).length,
      presentedPlans: countKind(events, "plan-presented"),
      structural: deriveStructural(events),
    },
  };
}
