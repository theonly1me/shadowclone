import { deliver } from "../delivery";
import { pairingNote } from "../messages";
import { activePairs, newPairId, newPeerKey, peerKeyHash, writePairs } from "../pairs";
import type { LiveRecord } from "../record";
import { openRecord, refused } from "./open";
import type { LivePairOutcome, PairingContext } from "./types";

export async function createPair(options: {
  readonly context: PairingContext;
  readonly first: string;
  readonly second: string;
}): Promise<LivePairOutcome> {
  const { context, first, second } = options;
  const { paths } = context;

  if (first === second) {
    return refused("Pair two different live sessions.");
  }

  const firstOpen = await openRecord({ paths, id: first });

  if (firstOpen.kind === "refused") {
    return firstOpen;
  }

  const secondOpen = await openRecord({ paths, id: second });

  if (secondOpen.kind === "refused") {
    return secondOpen;
  }

  const pairs = await activePairs(paths);
  const taken = pairs.find((pair) =>
    pair.sides.some((side) => side.session === first || side.session === second),
  );

  if (taken !== undefined) {
    const busy = taken.sides.some((side) => side.session === first) ? first : second;

    return refused(
      `${busy} is already in ${taken.id}. End that pair with shadowclone live unpair ${taken.id} first.`,
    );
  }

  const id = newPairId();
  const now = context.now();
  const firstKey = newPeerKey();
  const secondKey = newPeerKey();

  await writePairs({
    paths,
    pairs: [
      ...pairs,
      {
        id,
        sides: [
          { session: first, keyHash: peerKeyHash(firstKey) },
          { session: second, keyHash: peerKeyHash(secondKey) },
        ],
        createdAt: now.toISOString(),
        sent: 0,
      },
    ],
  });

  const introduce = (side: {
    readonly record: LiveRecord;
    readonly peer: LiveRecord;
    readonly key: string;
  }) =>
    deliver({
      paths,
      record: side.record,
      message: { kind: "pairing", pair: id, text: pairingNote({ pair: id, ...side }) },
      typeText: context.typeText,
      now,
    }).then((delivery) => ({ session: side.record.id, delivery }));

  return {
    kind: "paired",
    pair: id,
    deliveries: [
      await introduce({ record: firstOpen.record, peer: secondOpen.record, key: firstKey }),
      await introduce({ record: secondOpen.record, peer: firstOpen.record, key: secondKey }),
    ],
  };
}

