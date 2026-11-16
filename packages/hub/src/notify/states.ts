import { z } from "zod";
import type { CloneNode } from "@shadowclone/clones";
import type { LiveBrief, LiveRecord, LiveSessions } from "@shadowclone/live";
import { briefNeed, briefWaitsForOwner } from "@shadowclone/live/board";

export const sessionStateSchema = z.object({
  id: z.string(),
  kind: z.enum(["clone", "live"]),
  repository: z.string(),
  state: z.string(),
  needsYou: z.boolean(),
  question: z.string().nullable(),
  questionId: z.string().nullable(),
  task: z.string().nullable().default(null),
});

export type SessionState = z.infer<typeof sessionStateSchema>;

export type NodeStates = { readonly node: string; readonly states: readonly SessionState[] };

function liveState(options: {
  readonly record: LiveRecord;
  readonly brief: LiveBrief | null;
}): SessionState {
  const { record, brief } = options;
  const permission = record.state === "needs-you";

  if (brief !== null && briefWaitsForOwner(brief)) {
    return {
      id: record.id,
      kind: "live",
      repository: record.repository,
      state: record.state,
      needsYou: true,
      question: briefNeed(brief),
      questionId: `brief-${brief.messageDigest}`,
      task: brief.name,
    };
  }

  return {
    id: record.id,
    kind: "live",
    repository: record.repository,
    state: record.state,
    needsYou: permission,
    question: record.attention,
    questionId: permission ? record.updatedAt : null,
    task: brief?.name ?? null,
  };
}

export async function nodeStates(options: {
  readonly node: CloneNode;
  readonly live?: LiveSessions | undefined;
}): Promise<readonly SessionState[]> {
  const { clones } = await options.node.list({});
  const live = (await options.live?.list()) ?? [];
  const briefs = (await options.live?.currentBriefs(live)) ?? new Map<string, LiveBrief>();

  return [
    ...clones.map((clone): SessionState => {
      const open = clone.questions.find((question) => question.status === "open");

      return {
        id: clone.id,
        kind: "clone",
        repository: clone.repository,
        state: clone.state,
        needsYou: clone.needsYou,
        question: open?.text ?? null,
        questionId: open?.id ?? null,
        task: null,
      };
    }),
    ...live.map((record) => liveState({ record, brief: briefs.get(record.id) ?? null })),
  ];
}
