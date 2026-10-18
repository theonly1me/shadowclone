import { z } from "zod";

export const cloneStates = ["queued", "working", "done", "failed", "limited", "stopped"] as const;

export type CloneState = (typeof cloneStates)[number];

export const finalStates: readonly CloneState[] = ["done", "failed", "limited", "stopped"];

export const progressPrefix = "shadowclone-progress ";

export const progressSchema = z.strictObject({
  state: z.enum(["working", "done", "failed", "limited", "stopped"]),
  branch: z.string().max(255).optional(),
  pull: z.number().int().positive().optional(),
  engine: z.enum(["claude", "codex"]).optional(),
  detail: z.string().max(2000),
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
