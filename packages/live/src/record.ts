import { createHash } from "node:crypto";
import { z } from "zod";

export const liveIdPattern = /^live-[0-9a-f]{8}$/;

export const pairIdPattern = /^pair-[0-9a-f]{8}$/;

export const liveEngines = ["claude", "codex"] as const;

export type LiveEngine = (typeof liveEngines)[number];

export const liveStates = ["working", "idle", "needs-you", "ended"] as const;

const surfaceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cmux"), surface: z.string().min(1), socket: z.string().nullable() }),
  z.object({ kind: z.literal("tmux"), pane: z.string().min(1), socket: z.string().nullable() }),
]);

export type Surface = z.infer<typeof surfaceSchema>;

export const liveRecordSchema = z.object({
  id: z.string().regex(liveIdPattern),
  engine: z.enum(liveEngines),
  repository: z.string(),
  branch: z.string().nullable(),
  folder: z.string(),
  state: z.enum(liveStates),
  startedAt: z.string(),
  updatedAt: z.string(),
  summary: z.string(),
  attention: z.string().nullable(),
  surface: surfaceSchema.nullable(),
});

export type LiveRecord = z.infer<typeof liveRecordSchema>;

export function liveId(options: {
  readonly engine: LiveEngine;
  readonly sessionId: string;
}): string {
  const digest = createHash("sha256")
    .update(`${options.engine}:${options.sessionId}`)
    .digest("hex");

  return `live-${digest.slice(0, 8)}`;
}

export function surfaceFrom(
  environment: Readonly<Record<string, string | undefined>>,
): Surface | null {
  const cmux = environment.CMUX_SURFACE_ID;
  const pane = environment.TMUX_PANE;

  if (pane !== undefined && pane !== "") {
    return { kind: "tmux", pane, socket: environment.TMUX?.split(",")[0] ?? null };
  }

  if (cmux !== undefined && cmux !== "") {
    return { kind: "cmux", surface: cmux, socket: environment.CMUX_SOCKET_PATH ?? null };
  }

  return null;
}
