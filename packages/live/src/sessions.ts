import type { LivePaths } from "./paths";
import type { LiveRecord } from "./record";
import { appendInbox, listRecords, readRecord, takeInbox } from "./store";
import { oneLine, type TypeText } from "./terminal";
import { liveOwnerMessage } from "./messages";

export type LiveSendOutcome =
  | { readonly kind: "typed" | "queued"; readonly detail: string }
  | { readonly kind: "refused"; readonly reason: string };

export type LiveSessions = {
  readonly list: () => Promise<readonly LiveRecord[]>;
  readonly get: (id: string) => Promise<LiveRecord | null>;
  readonly send: (options: {
    readonly id: string;
    readonly text: string;
  }) => Promise<LiveSendOutcome>;
};

export const liveOffReason =
  "Live sessions are off on this machine. Run shadowclone live enable there.";

export function localLive(options: {
  readonly paths: LivePaths;
  readonly enabled: () => Promise<boolean>;
  readonly typeText: TypeText;
  readonly now?: () => Date;
}): LiveSessions {
  const now = options.now ?? (() => new Date());
  const { paths } = options;

  return {
    list: async () => ((await options.enabled()) ? listRecords({ paths, now: now() }) : []),
    get: async (id) => ((await options.enabled()) ? readRecord({ paths, id }) : null),
    send: async ({ id, text }) => {
      if (!(await options.enabled())) {
        return { kind: "refused", reason: liveOffReason };
      }

      const record = await readRecord({ paths, id });

      if (record === null) {
        return { kind: "refused", reason: `No live session ${id} exists on this machine.` };
      }

      if (record.state === "ended") {
        return { kind: "refused", reason: `Live session ${id} already ended.` };
      }

      await appendInbox({ paths, id, text, now: now() });

      if (record.state === "needs-you") {
        return {
          kind: "queued",
          detail:
            "The session waits for an answer in its terminal or in Remote Control. Your message reaches it after that.",
        };
      }

      if (record.state === "working" || record.surface === null) {
        return {
          kind: "queued",
          detail:
            record.state === "working"
              ? "It reaches the session after its next tool call, or when its turn ends."
              : "The session is idle outside cmux and tmux, so your message waits for its next turn.",
        };
      }

      const pending = await takeInbox({ paths, id });

      if (
        await options.typeText({
          surface: record.surface,
          text: oneLine(liveOwnerMessage(pending)),
        })
      ) {
        return {
          kind: "typed",
          detail: `shadowclone typed it into the ${record.surface.kind} terminal of the session.`,
        };
      }

      for (const message of pending) {
        await appendInbox({ paths, id, text: message, now: now() });
      }

      return {
        kind: "queued",
        detail: `${record.surface.kind} refused the input, so your message waits for the next turn of the session.`,
      };
    },
  };
}
