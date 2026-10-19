import type { CloneView } from "./record";
import type { SendOutcome, StartOutcome, StopOutcome } from ".";
import type { QuestionRecord } from "./store";

function pullText(view: CloneView): string {
  return view.pull === null
    ? "no pull request yet"
    : `https://github.com/${view.repository}/pull/${view.pull}`;
}

function questionLines(question: QuestionRecord): readonly string[] {
  return [
    `  ${question.id} (${question.status}): ${question.text}`,
    ...(question.options.length === 0 ? [] : [`    Options: ${question.options.join(" | ")}`]),
    `    Recommended: ${question.recommended}`,
    ...(question.answer === null ? [] : [`    Answer: ${question.answer}`]),
  ];
}

export function cloneListLine(view: CloneView): string {
  return `${view.id} ${view.needsYou ? "needs-you" : view.state} ${view.repository} ${view.branch ?? "-"} ${view.pull === null ? "-" : `#${view.pull}`} ${view.updatedAt} ${view.summary}`;
}

export function cloneDetailLines(view: CloneView): readonly string[] {
  return [
    `Clone ${view.id} in ${view.repository}: ${view.state}`,
    `Request: ${view.summary}`,
    `Branch: ${view.branch ?? "not chosen yet"}`,
    `Pull request: ${pullText(view)}`,
    `Created ${view.createdAt}, started ${view.startedAt ?? "not yet"}, updated ${view.updatedAt}`,
    `Detail: ${view.detail}`,
    ...(view.questions.length === 0
      ? []
      : ["Questions:", ...view.questions.flatMap(questionLines)]),
    ...(view.report === null ? [] : ["Report:", view.report]),
    ...(view.task === "" ? [] : ["Task:", view.task]),
    ...(view.events.length === 0
      ? []
      : [
          "Events:",
          ...view.events.map((event) => `  ${event.at} ${event.state}: ${event.detail}`),
        ]),
  ];
}

export function startText(outcome: StartOutcome): string {
  if (outcome.kind === "refused") {
    return outcome.reason;
  }

  return [
    `Queued clone ${outcome.clone.id} for ${outcome.clone.repository}: ${outcome.clone.summary}`,
    ...(outcome.serveRunning
      ? []
      : [
          "shadowclone serve does not run on this machine, so the clone waits. Start shadowclone serve, or run shadowclone clone setup to install the service.",
        ]),
  ].join("\n");
}

export function stopText(options: { readonly id: string; readonly outcome: StopOutcome }): string {
  const { outcome } = options;

  if (outcome.kind === "unknown") {
    return `No clone ${options.id} exists on this machine.`;
  }

  return outcome.kind === "already-finished"
    ? `Clone ${options.id} already ended: ${outcome.clone.state}.`
    : `Clone ${options.id} stops. A running clone pushes its unfinished work to its branch first.`;
}

export function sendText(options: {
  readonly outcome: SendOutcome;
  readonly what: string;
}): string {
  return options.outcome.kind === "refused"
    ? options.outcome.reason
    : `Sent the ${options.what} to clone ${options.outcome.clone.id}. ${options.outcome.clone.state === "queued" ? "It reaches the clone when the clone starts." : "It reaches the clone within a few seconds."}`;
}
