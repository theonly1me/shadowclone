import type { CloneState, Progress } from "./progress";
import { maximumEvents, type CloneRecord } from "./store";

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
    questions: [],
    summary: null,
  };
}

function withQuestions(options: {
  readonly record: CloneRecord;
  readonly progress: Progress;
  readonly now: Date;
}): CloneRecord["questions"] {
  const { progress } = options;
  const expired = new Set(progress.expired ?? []);
  const known = options.record.questions.map((entry) =>
    expired.has(entry.id) && entry.status === "open"
      ? { ...entry, status: "expired" as const }
      : entry,
  );
  const asked = progress.question;

  if (asked === undefined || known.some((entry) => entry.id === asked.id)) {
    return known;
  }

  return [
    ...known,
    { ...asked, askedAt: options.now.toISOString(), status: "open" as const, answer: null },
  ].slice(-50);
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
    questions: withQuestions(options),
    summary: progress.summary ?? record.summary,
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

export function deliveredRecord(options: {
  readonly record: CloneRecord;
  readonly delivery:
    | { readonly kind: "message" }
    | { readonly kind: "answer"; readonly question: string; readonly text: string };
  readonly now: Date;
}): CloneRecord {
  const { record, delivery } = options;
  const detail =
    delivery.kind === "message"
      ? "You sent the clone a message."
      : `You answered question ${delivery.question}.`;

  return {
    ...record,
    updatedAt: options.now.toISOString(),
    events: withEvent({ record, state: record.state, detail, now: options.now }),
    questions: record.questions.map((entry) =>
      delivery.kind === "answer" && entry.id === delivery.question
        ? { ...entry, status: "answered" as const, answer: delivery.text }
        : entry,
    ),
  };
}
