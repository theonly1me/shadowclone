import type { BoardDetail, BoardPair, BoardSession } from "./board";
import type { LivePairView } from "./pairing";
import { pairNoteLimit } from "./pairs";
import type { LiveRecord } from "./record";
import { firstLine } from "./text";

export function liveBoardSession(record: LiveRecord): BoardSession {
  return {
    id: record.id,
    engine: record.engine,
    state: record.state,
    repository: record.repository,
    branch: record.branch,
    updatedAt: record.updatedAt,
    message: firstLine(record.attention ?? record.summary),
  };
}

export function liveBoardPair(pair: LivePairView): BoardPair {
  const [first, second] = pair.sessions;

  return {
    id: pair.id,
    sessions: [first, second],
    sent: pair.sent,
    limit: pairNoteLimit,
    createdAt: pair.createdAt,
  };
}

export function liveBoardDetail(record: LiveRecord): BoardDetail {
  return {
    kind: "session",
    session: {
      id: record.id,
      engine: record.engine,
      state: record.state,
      repository: record.repository,
      branch: record.branch,
      folder: record.folder,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
      terminal: record.surface?.kind ?? null,
      attention: record.attention,
      summary: record.summary,
    },
  };
}
