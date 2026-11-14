import { z } from "zod";

export type RemoteSettings = {
  readonly liveSessions: boolean;
  readonly taskBriefs: boolean;
};

const remoteSchema = z.strictObject({
  "live-sessions": z.boolean().optional().default(false),
  "task-briefs": z.boolean().optional().default(false),
});

export function parseRemote(value: unknown): RemoteSettings {
  const result = remoteSchema.safeParse(value);

  if (!result.success) {
    throw new Error("Config remote must contain only the live-sessions and task-briefs booleans");
  }

  return { liveSessions: result.data["live-sessions"], taskBriefs: result.data["task-briefs"] };
}

export function renderRemote(remote: RemoteSettings): Readonly<Record<string, boolean>> {
  return {
    "live-sessions": remote.liveSessions,
    ...(remote.taskBriefs ? { "task-briefs": true } : {}),
  };
}
