import type { CloneEngine } from "../config/providers";
import type { CloneState } from "./progress";
import { requestSummary, type CloneRequest } from "./request";
import type { CloneRecord, QuestionRecord, StoredRun } from "./store";

export type CloneEvent = CloneRecord["events"][number];

export type CloneView = {
  readonly id: string;
  readonly repository: string;
  readonly kind: CloneRequest["kind"];
  readonly summary: string;
  readonly task: string;
  readonly state: CloneState;
  readonly branch: string | null;
  readonly pull: number | null;
  readonly engine: CloneEngine | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly detail: string;
  readonly events: readonly CloneEvent[];
  readonly questions: readonly QuestionRecord[];
  readonly needsYou: boolean;
  readonly report: string | null;
};

export function cloneState(run: StoredRun): CloneState {
  return run.record?.state ?? (run.stopRequested ? "stopped" : "queued");
}

export function isActive(run: StoredRun): boolean {
  const state = cloneState(run);

  return state === "queued" || state === "working" || state === "waiting";
}

export function openQuestion(options: {
  readonly run: StoredRun;
  readonly question: string;
}): QuestionRecord | null {
  return (
    options.run.record?.questions.find(
      (entry) => entry.id === options.question && entry.status === "open",
    ) ?? null
  );
}

export function cloneView(run: StoredRun): CloneView {
  const { request, record } = run;
  const state = cloneState(run);
  const questions = record?.questions ?? [];

  return {
    id: request.id,
    repository: request.repository,
    kind: request.kind,
    summary: requestSummary(request),
    task: request.kind === "work" ? request.task : "",
    state,
    branch: record?.branch ?? null,
    pull: record?.pull ?? (request.kind === "review" ? request.pull : null),
    engine: record?.engine ?? null,
    createdAt: request.createdAt,
    startedAt: record?.startedAt ?? null,
    updatedAt: record?.updatedAt ?? request.createdAt,
    detail:
      record?.detail ??
      (state === "stopped"
        ? "You stopped the clone before it started."
        : "The clone waits for shadowclone serve to start it."),
    events: record?.events ?? [],
    questions,
    needsYou: isActive(run) && questions.some((entry) => entry.status === "open"),
    report: record?.summary ?? null,
  };
}
