import { z } from "zod";

export const cloneStates = [
  "queued",
  "working",
  "waiting",
  "done",
  "failed",
  "limited",
  "stopped",
] as const;

export type CloneState = (typeof cloneStates)[number];

export const finalStates: readonly CloneState[] = ["done", "failed", "limited", "stopped"];

export const progressPrefix = "shadowclone-progress ";

export const questionIdPattern = /^q[a-z0-9]{6}$/;

export const askedQuestionSchema = z.strictObject({
  id: z.string().regex(questionIdPattern),
  text: z.string().min(1).max(2000),
  options: z.array(z.string().min(1).max(200)).max(6),
  recommended: z.string().min(1).max(200),
});

export type AskedQuestion = z.infer<typeof askedQuestionSchema>;

export const progressSchema = z.strictObject({
  state: z.enum(["working", "waiting", "done", "failed", "limited", "stopped"]),
  branch: z.string().max(255).optional(),
  pull: z.number().int().positive().optional(),
  engine: z.enum(["claude", "codex"]).optional(),
  detail: z.string().max(2000),
  question: askedQuestionSchema.optional(),
  expired: z.array(z.string().regex(questionIdPattern)).max(50).optional(),
  summary: z.string().max(4000).optional(),
});

export type Progress = z.infer<typeof progressSchema>;

export function progressLine(progress: Progress): string {
  return `${progressPrefix}${JSON.stringify(progressSchema.parse(progress))}`;
}

export function parseProgressLine(line: string): Progress | null {
  if (!line.startsWith(progressPrefix)) {
    return null;
  }

  try {
    const parsed = progressSchema.safeParse(JSON.parse(line.slice(progressPrefix.length)));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
