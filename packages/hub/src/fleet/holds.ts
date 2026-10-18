import type { CloneNode } from "@shadowclone/clones";
import { liveIdPattern, type LiveSessions } from "@shadowclone/live";

export async function holds(options: {
  readonly node: CloneNode;
  readonly live: LiveSessions | undefined;
  readonly id: string;
}): Promise<boolean> {
  return liveIdPattern.test(options.id)
    ? ((await options.live?.get(options.id)) ?? null) !== null
    : (await options.node.get(options.id)) !== null;
}
