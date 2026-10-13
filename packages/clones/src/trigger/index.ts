import type { GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import { resolveCi } from "./ci";
import { resolveComment } from "./comment";
import type { Resolution, SessionEvent } from "./event";

export async function resolveSessionRequest(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly event: SessionEvent;
  readonly now: Date;
}): Promise<Resolution> {
  const { event } = options;

  return event.kind === "ci"
    ? resolveCi({ ...options, runId: event.runId })
    : resolveComment({ ...options, source: event.source, id: event.id, entity: event.entity });
}
