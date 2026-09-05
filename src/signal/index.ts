import type {
  CorpusSummary,
  IndexedEvent,
} from "../index";
import { mineCorrections } from "./corrections";
import { resolveEventOrigins } from "./origin";
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
  readonly origins: ReadonlyMap<string, OriginScope>;
  readonly report: MirrorReport;
};

export type {
  CorrectionSignal,
  CorrectionSignalKind,
  CountedCategory,
  OriginScope,
  StructuralSummary,
} from "./types";
export {
  getEventOrigin,
  normalizeRemoteOrigin,
  readGitRemote,
  resolveEventOrigins,
  type GitRemoteReader,
} from "./origin";

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
}): Promise<DerivedSignals> {
  const origins = await resolveEventOrigins({
    events: options.events,
    enabled: options.gitMetadataEnabled,
    readRemote: options.readRemote,
  });
  const corrections = mineCorrections({ events: options.events, origins });
  const interruptions = corrections.filter(
    (signal) => signal.kind === "interruption",
  );
  const denials = corrections.filter(
    (signal) => signal.kind === "permission-denied",
  );

  return {
    corrections,
    origins,
    report: {
      corpus: options.corpus,
      interruptions: countSignals(interruptions),
      denials: countSignals(denials),
      answeredQuestions: corrections.filter(
        (signal) => signal.kind === "question-answered",
      ).length,
      askedQuestions: countKind(options.events, "question-asked"),
      resolvedPlans: corrections.filter(
        (signal) => signal.kind === "plan-resolved",
      ).length,
      presentedPlans: countKind(options.events, "plan-presented"),
      structural: deriveStructural(options.events),
    },
  };
}
