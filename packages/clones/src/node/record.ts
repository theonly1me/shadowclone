import type { CloneEngine } from "../config/providers";
import type { CloneState, Progress } from "./progress";
import { requestSummary, type CloneRequest } from "./request";
import { maximumEvents, type CloneRecord, type StoredRun } from "./store";

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
};

export function cloneState(run: StoredRun): CloneState {
  return run.record?.state ?? (run.stopRequested ? "stopped" : "queued");
}

export function isActive(run: StoredRun): boolean {
  const state = cloneState(run);

  return state === "queued" || state === "working";
}

export function cloneView(run: StoredRun): CloneView {
  const { request, record } = run;
  const state = cloneState(run);

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
  };
}

function withEvent(options: {
  readonly record: CloneRecord;
  readonly state: CloneState;
  readonly detail: string;
  readonly now: Date;
}): CloneRecord["events"] {
  const { record } = options;
  const last = record.events.at(-1);

  if (last?.state === options.state && last.detail === options.detail) {
    return record.events;
  }

  return [
    ...record.events,
    { at: options.now.toISOString(), state: options.state, detail: options.detail },
  ].slice(-maximumEvents);
}

export function startedRecord(now: Date): CloneRecord {
  const detail = "Starting the container.";

  return {
    state: "working",
    branch: null,
    pull: null,
    engine: null,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    detail,
    events: [{ at: now.toISOString(), state: "working", detail }],
  };
}

export function progressedRecord(options: {
  readonly record: CloneRecord;
  readonly progress: Progress;
  readonly now: Date;
}): CloneRecord {
  const { record, progress } = options;

  return {
    ...record,
    state: progress.state,
    branch: progress.branch ?? record.branch,
    pull: progress.pull ?? record.pull,
    engine: progress.engine ?? record.engine,
    updatedAt: options.now.toISOString(),
    detail: progress.detail,
    events: withEvent({ ...options, state: progress.state, detail: progress.detail }),
  };
}

export function endedRecord(options: {
  readonly record: CloneRecord;
  readonly state: CloneState;
  readonly detail: string;
  readonly now: Date;
}): CloneRecord {
  return {
    ...options.record,
    state: options.state,
    updatedAt: options.now.toISOString(),
    detail: options.detail,
    events: withEvent(options),
  };
}
