import { boardDetailSchema, boardListSchema } from "@shadowclone/live/board";
import type { FleetBoard, FleetNode, FleetPair, FleetSession } from "../board/schema";
import type { ToolResult } from "./protocol";

export type NodeAnswer =
  | { readonly name: string; readonly kind: "offline"; readonly lastSeenAt: string | null }
  | { readonly name: string; readonly kind: "answered"; readonly result: ToolResult };

type NodeRows = {
  readonly node: FleetNode;
  readonly sessions: readonly FleetSession[];
  readonly pairs: readonly FleetPair[];
};

function resultText(result: ToolResult): string {
  return result.content.map((part) => part.text).join("\n");
}

function rowsOf(answer: NodeAnswer): NodeRows {
  const { name } = answer;

  if (answer.kind === "offline") {
    return {
      node: { name, status: "offline", lastSeenAt: answer.lastSeenAt },
      sessions: [],
      pairs: [],
    };
  }

  if (answer.result.isError) {
    return {
      node: { name, status: "failed", text: resultText(answer.result) },
      sessions: [],
      pairs: [],
    };
  }

  const board = boardListSchema.safeParse(answer.result.structuredContent);

  if (!board.success) {
    return {
      node: { name, status: "text", text: resultText(answer.result) },
      sessions: [],
      pairs: [],
    };
  }

  return {
    node: {
      name,
      status: "online",
      live: board.data.live,
      ended: board.data.ended,
      clones: board.data.clones,
    },
    sessions: board.data.sessions.map((session) => ({ ...session, node: name })),
    pairs: board.data.pairs.map((pair) => ({ ...pair, node: name })),
  };
}

export function fleetBoard(options: {
  readonly hub: string;
  readonly answers: readonly NodeAnswer[];
}): FleetBoard {
  const rows = options.answers.map(rowsOf);

  return {
    kind: "fleet",
    hub: options.hub,
    nodes: rows.map((entry) => entry.node),
    sessions: rows.flatMap((entry) => entry.sessions),
    pairs: rows.flatMap((entry) => entry.pairs),
  };
}

export function answerText(answer: NodeAnswer): string {
  return answer.kind === "offline"
    ? `Node ${answer.name}: offline, last seen ${answer.lastSeenAt ?? "never"}.`
    : `Node ${answer.name}:\n${resultText(answer.result)}`;
}

export function withKnownBoard(result: ToolResult): ToolResult {
  const { structuredContent, ...rest } = result;
  const list = boardListSchema.safeParse(structuredContent);
  const detail = boardDetailSchema.safeParse(structuredContent);

  if (list.success) {
    return { ...rest, structuredContent: list.data };
  }

  return detail.success ? { ...rest, structuredContent: detail.data } : rest;
}
