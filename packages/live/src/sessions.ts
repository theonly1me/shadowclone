import { briefIsCurrent, readBrief, type LiveBrief } from "./brief";
import { deliver, type LiveDelivery } from "./delivery";
import { liveOffReason } from "./messages";
import { localPairing, type LivePairing } from "./pairing";
import type { LivePaths } from "./paths";
import type { LiveRecord } from "./record";
import { listRecords, readRecord } from "./store";
import type { TypeText } from "./terminal";

export type LiveSendOutcome = LiveDelivery | { readonly kind: "refused"; readonly reason: string };

export type LiveSessions = LivePairing & {
  readonly enabled: () => Promise<boolean>;
  readonly list: () => Promise<readonly LiveRecord[]>;
  readonly get: (id: string) => Promise<LiveRecord | null>;
  readonly currentBriefs: (
    records: readonly LiveRecord[],
  ) => Promise<ReadonlyMap<string, LiveBrief>>;
  readonly send: (options: {
    readonly id: string;
    readonly text: string;
  }) => Promise<LiveSendOutcome>;
};

export function localLive(options: {
  readonly paths: LivePaths;
  readonly enabled: () => Promise<boolean>;
  readonly briefsEnabled?: () => Promise<boolean>;
  readonly typeText: TypeText;
  readonly now?: () => Date;
}): LiveSessions {
  const now = options.now ?? (() => new Date());
  const { paths } = options;

  return {
    ...localPairing({ ...options, now }),
    enabled: options.enabled,
    list: async () => ((await options.enabled()) ? listRecords({ paths, now: now() }) : []),
    get: async (id) => ((await options.enabled()) ? readRecord({ paths, id }) : null),
    currentBriefs: async (records) => {
      if (!(await (options.briefsEnabled?.() ?? false))) {
        return new Map<string, LiveBrief>();
      }

      const entries = await Promise.all(
        records.map(async (record) => {
          const brief = await readBrief({ paths, id: record.id });

          return brief !== null && briefIsCurrent({ record, brief })
            ? [[record.id, brief] as const]
            : [];
        }),
      );

      return new Map(entries.flat());
    },
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

      return deliver({
        paths,
        record,
        message: { kind: "owner", text },
        typeText: options.typeText,
        now: now(),
      });
    },
  };
}
