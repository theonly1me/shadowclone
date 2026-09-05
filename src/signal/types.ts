import type { TextRef } from "../observe";

export type OriginScope = {
  readonly id: string;
  readonly directoryName: string;
  readonly promotable: boolean;
};

export type CorrectionSignalKind =
  | "interruption"
  | "permission-denied"
  | "question-answered"
  | "plan-resolved";

export type CorrectionSignal = {
  readonly kind: CorrectionSignalKind;
  readonly category: string;
  readonly label: string;
  readonly sessionId: string;
  readonly timestamp: number;
  readonly origin: OriginScope;
  readonly textRefs: readonly TextRef[];
};

export type CountedCategory = {
  readonly category: string;
  readonly label: string;
  readonly count: number;
};

export type StructuralSummary = {
  readonly toolUses: readonly CountedCategory[];
  readonly planSessions: number;
  readonly totalSessions: number;
};
