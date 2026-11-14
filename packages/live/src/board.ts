import { z } from "zod";

export const liveIdPattern = /^live-[0-9a-f]{8}$/;

export const pairIdPattern = /^pair-[0-9a-f]{8}$/;

export const liveEngines = ["claude", "codex"] as const;

export const liveStates = ["working", "idle", "needs-you", "ended"] as const;

export type LiveState = (typeof liveStates)[number];

const liveId = z.string().regex(liveIdPattern);

export const liveBriefKinds = ["question", "finished", "blocked"] as const;

export const boardBriefSchema = z.strictObject({
  name: z.string(),
  goal: z.string(),
  done: z.string(),
  kind: z.enum(liveBriefKinds),
  question: z.string().nullable(),
  options: z.array(z.string()).max(4),
});

export type BoardBrief = z.infer<typeof boardBriefSchema>;

export function briefWaitsForOwner(brief: BoardBrief): boolean {
  return brief.kind === "question" || brief.kind === "blocked";
}

export function briefNeed(brief: BoardBrief): string {
  switch (brief.kind) {
    case "question":
      return brief.question ?? "It asks you a question. Read its last message.";
    case "blocked":
      return "It cannot continue without your help. Read its last message.";
    case "finished":
      return "It finished. Check the result.";
  }
}

export const boardSessionSchema = z.strictObject({
  id: liveId,
  engine: z.enum(liveEngines),
  state: z.enum(liveStates),
  repository: z.string(),
  branch: z.string().nullable(),
  updatedAt: z.string(),
  message: z.string(),
  brief: boardBriefSchema.optional(),
});

export type BoardSession = z.infer<typeof boardSessionSchema>;

export const boardPairSchema = z.strictObject({
  id: z.string().regex(pairIdPattern),
  sessions: z.tuple([liveId, liveId]),
  sent: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  createdAt: z.string(),
});

export type BoardPair = z.infer<typeof boardPairSchema>;

export const boardListSchema = z.strictObject({
  kind: z.literal("list"),
  live: z.enum(["on", "off"]),
  sessions: z.array(boardSessionSchema),
  pairs: z.array(boardPairSchema),
  ended: z.number().int().nonnegative(),
  clones: z.number().int().nonnegative(),
});

export type BoardList = z.infer<typeof boardListSchema>;

export const boardDetailSchema = z.strictObject({
  kind: z.literal("session"),
  session: z.strictObject({
    id: liveId,
    engine: z.enum(liveEngines),
    state: z.enum(liveStates),
    repository: z.string(),
    branch: z.string().nullable(),
    folder: z.string(),
    startedAt: z.string(),
    updatedAt: z.string(),
    terminal: z.enum(["cmux", "tmux"]).nullable(),
    attention: z.string().nullable(),
    summary: z.string(),
  }),
});

export type BoardDetail = z.infer<typeof boardDetailSchema>;
