import type {
  LivePairOutcome,
  LivePairView,
  LivePeerOutcome,
  LiveUnpairOutcome,
} from "./pairing";
import { pairNoteLimit } from "./pairs";
import type { LiveRecord } from "./record";
import type { LiveSendOutcome } from "./sessions";

function firstLine(text: string): string {
  const line = text.split("\n").find((entry) => entry.trim() !== "") ?? "";

  return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

export function liveListLine(record: LiveRecord): string {
  return `${record.id} ${record.state} ${record.engine} ${record.repository} ${record.branch ?? "-"} ${record.updatedAt} ${firstLine(record.attention ?? record.summary)}`;
}

export function liveDetailLines(record: LiveRecord): readonly string[] {
  return [
    `Live ${record.engine} session ${record.id} in ${record.repository}: ${record.state}`,
    `Branch: ${record.branch ?? "unknown"}`,
    `Folder: ${record.folder}`,
    `Started ${record.startedAt}, updated ${record.updatedAt}`,
    `Terminal: ${record.surface?.kind ?? "not cmux or tmux"}`,
    ...(record.attention === null ? [] : [`Needs you: ${record.attention}`]),
    ...(record.summary === "" ? [] : ["Last message:", record.summary]),
  ];
}

export function liveSendText(options: {
  readonly id: string;
  readonly outcome: LiveSendOutcome;
}): string {
  const { outcome } = options;

  if (outcome.kind === "refused") {
    return outcome.reason;
  }

  return `${outcome.kind === "typed" ? "Sent" : "Queued"} the message for live session ${options.id}. ${outcome.detail}`;
}

export function livePairLines(pairs: readonly LivePairView[]): readonly string[] {
  return pairs.map(({ id, sessions: [first, second], sent, createdAt }) => {
    return `${id} ${first} ${second} ${sent} of ${pairNoteLimit} notes sent, since ${createdAt}`;
  });
}

export function livePairText(outcome: LivePairOutcome): string {
  if (outcome.kind === "refused") {
    return outcome.reason;
  }

  return [
    `Paired ${outcome.deliveries.map((entry) => entry.session).join(" and ")} as ${outcome.pair}. The two sessions can send ${pairNoteLimit} notes in total.`,
    ...outcome.deliveries.map(
      ({ session, delivery }) => `Pairing note for ${session}: ${delivery.detail}`,
    ),
  ].join("\n");
}

export function liveUnpairText(outcome: LiveUnpairOutcome): string {
  return outcome.kind === "refused"
    ? outcome.reason
    : `Ended ${outcome.pair}. Its sessions can no longer send each other notes.`;
}

export function livePeerText(outcome: LivePeerOutcome): string {
  if (outcome.kind === "refused") {
    return outcome.reason;
  }

  return `${outcome.delivery.kind === "typed" ? "Sent" : "Queued"} the note for ${outcome.to}. ${outcome.delivery.detail} The pair has ${outcome.left} notes left.`;
}
