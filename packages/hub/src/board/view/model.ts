import type { BoardDetail } from "@shadowclone/live/board";
import type { FleetBoard, FleetNode, FleetSession } from "../schema";

export type SessionGroups = {
  readonly needsYou: readonly FleetSession[];
  readonly yourTurn: readonly FleetSession[];
  readonly working: readonly FleetSession[];
};

export type Tone = "quiet" | "fault";

export type Notice = { readonly tone: Tone; readonly text: string };

export type SessionDetail = BoardDetail["session"];

function newestFirst(sessions: readonly FleetSession[]): readonly FleetSession[] {
  return [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function sessionGroups(sessions: readonly FleetSession[]): SessionGroups {
  const sorted = newestFirst(sessions);

  return {
    needsYou: sorted.filter((session) => session.state === "needs-you"),
    yourTurn: sorted.filter((session) => session.state === "idle"),
    working: sorted.filter((session) => session.state === "working"),
  };
}

export function loudSession(board: FleetBoard): FleetSession | null {
  const [newest] = newestFirst(
    board.sessions.filter((session) => session.state === "needs-you" || session.state === "idle"),
  );

  return newest ?? null;
}

function count(options: {
  readonly value: number;
  readonly one: string;
  readonly many: string;
}): string {
  return `${options.value} ${options.value === 1 ? options.one : options.many}`;
}

export function headline(board: FleetBoard): readonly string[] {
  const groups = sessionGroups(board.sessions);
  const lines = [
    ...(groups.needsYou.length === 0
      ? []
      : [
          `${count({ value: groups.needsYou.length, one: "session needs", many: "sessions need" })} you.`,
        ]),
    ...(groups.yourTurn.length === 0
      ? []
      : [
          `${count({ value: groups.yourTurn.length, one: "waits", many: "wait" })} for your reply.`,
        ]),
  ];

  return lines.length === 0 && board.sessions.length > 0 ? ["No session waits for you."] : lines;
}

export function endedText(board: FleetBoard): string | null {
  const ended = board.nodes.reduce(
    (total, node) => total + (node.status === "online" ? node.ended : 0),
    0,
  );

  return ended === 0 ? null : `${count({ value: ended, one: "session", many: "sessions" })} ended.`;
}

export function emptyText(board: FleetBoard): string | null {
  if (board.sessions.length > 0) {
    return null;
  }

  const hub = board.nodes.find((node) => node.name === board.hub);

  return hub?.status === "online" && hub.live === "off"
    ? "Live sessions are off on this machine. Run shadowclone live enable there."
    : "No sessions run on this machine. Start Claude Code or Codex, and it shows here.";
}

export function nodeNotice(node: FleetNode): Notice | null {
  switch (node.status) {
    case "online":
      return null;
    case "offline":
      return {
        tone: "fault",
        text: `${node.name} is offline. Last seen ${node.lastSeenAt ?? "never"}.`,
      };
    case "failed":
      return { tone: "fault", text: `${node.name} did not answer. ${node.text}` };
    case "text":
      return { tone: "quiet", text: `Update shadowclone on ${node.name}.\n${node.text}` };
  }
}

export function deliveryNotice(options: {
  readonly text: string;
  readonly isError: boolean;
}): Notice {
  return { tone: options.isError ? "fault" : "quiet", text: options.text };
}

export function ageText(options: { readonly updatedAt: string; readonly now: number }): string {
  const minutes = Math.floor((options.now - Date.parse(options.updatedAt)) / 60_000);

  if (Number.isNaN(minutes) || minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return minutes < 1440 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d`;
}

export function canPair(options: {
  readonly board: FleetBoard;
  readonly session: FleetSession;
}): boolean {
  return options.session.node === options.board.hub && options.session.state !== "ended";
}
