import { liveOffReason } from "../messages";
import { activePairs, removePair, type LivePair } from "../pairs";
import { createPair } from "./create";
import { sendNote } from "./note";
import { refused } from "./open";
import type { LivePairView, LivePairing, PairingContext, Refused } from "./types";

export type {
  LivePairOutcome,
  LivePairView,
  LivePairing,
  LivePeerOutcome,
  LiveUnpairOutcome,
} from "./types";

function viewOf(pair: LivePair): LivePairView {
  const [first, second] = pair.sides;

  return {
    id: pair.id,
    sessions: [first.session, second.session],
    sent: pair.sent,
    createdAt: pair.createdAt,
  };
}

async function whenEnabled<Outcome>(options: {
  readonly enabled: () => Promise<boolean>;
  readonly run: () => Promise<Outcome>;
}): Promise<Outcome | Refused> {
  return (await options.enabled()) ? options.run() : refused(liveOffReason);
}

export function localPairing(context: PairingContext): LivePairing {
  const { paths, enabled } = context;

  return {
    pair: ({ first, second }) =>
      whenEnabled({ enabled, run: () => createPair({ context, first, second }) }),
    unpair: (pair) =>
      whenEnabled({
        enabled,
        run: async () =>
          (await removePair({ paths, id: pair }))
            ? { kind: "unpaired" as const, pair }
            : refused(`No pair ${pair} exists on this machine.`),
      }),
    pairs: async () => ((await enabled()) ? (await activePairs(paths)).map(viewOf) : []),
    peerSend: ({ key, text }) => whenEnabled({ enabled, run: () => sendNote({ context, key, text }) }),
  };
}
