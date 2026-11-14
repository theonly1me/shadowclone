import type { BoardBrief, BoardDetail, BoardPair, BoardSession } from "./board";
import type { LiveBrief } from "./brief";
import type { LivePairView } from "./pairing";
import { pairNoteLimit } from "./pairs";
import type { LiveRecord } from "./record";
import { firstLine } from "./text";

function boardBrief(brief: LiveBrief): BoardBrief {
  return {
    name: brief.name,
    goal: brief.goal,
    done: brief.done,
    kind: brief.kind,
    question: brief.question,
    options: brief.options,
  };
}

export function liveBoardSession(options: {
  readonly record: LiveRecord;
  readonly brief: LiveBrief | null;
}): BoardSession {
  const { record, brief } = options;

  return {
    id: record.id,
    engine: record.engine,
    state: record.state,
    repository: record.repository,
    branch: record.branch,
    updatedAt: record.updatedAt,
    message: firstLine(record.attention ?? record.summary),
    ...(brief === null ? {} : { brief: boardBrief(brief) }),
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
