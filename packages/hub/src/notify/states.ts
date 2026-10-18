import { z } from "zod";
import type { CloneNode } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";

export const sessionStateSchema = z.object({
  id: z.string(),
  kind: z.enum(["clone", "live"]),
  repository: z.string(),
  state: z.string(),
  needsYou: z.boolean(),
  question: z.string().nullable(),
  questionId: z.string().nullable(),
});

export type SessionState = z.infer<typeof sessionStateSchema>;

export type NodeStates = { readonly node: string; readonly states: readonly SessionState[] };

export async function nodeStates(options: {
  readonly node: CloneNode;
  readonly live?: LiveSessions | undefined;
}): Promise<readonly SessionState[]> {
  const { clones } = await options.node.list({});
  const live = (await options.live?.list()) ?? [];

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
      };
    }),
    ...live.map((record): SessionState => ({
      id: record.id,
      kind: "live",
      repository: record.repository,
      state: record.state,
      needsYou: record.state === "needs-you",
      question: record.attention,
      questionId: record.state === "needs-you" ? record.updatedAt : null,
    })),
  ];
}
