import { deliver } from "../delivery";
import { peerNoteText } from "../messages";
import { activePairs, pairNoteLimit, peerKeyHash, writePairs } from "../pairs";
import { openRecord, refused } from "./open";
import type { LivePeerOutcome, PairingContext } from "./types";

export async function sendNote(options: {
  readonly context: PairingContext;
  readonly key: string;
  readonly text: string;
}): Promise<LivePeerOutcome> {
  const { context } = options;
  const { paths } = context;
  const hash = peerKeyHash(options.key);
  const text = peerNoteText(options.text);
  const pairs = await activePairs(paths);
  const pair = pairs.find((entry) => entry.sides.some((side) => side.keyHash === hash));

  if (pair === undefined) {
    return refused(
      "This key belongs to no open pair. The pair ended, or the key is wrong. Ask the owner to pair the sessions again.",
    );
  }

  if (pair.sent >= pairNoteLimit) {
    return refused(
      `${pair.id} already sent its ${pairNoteLimit} notes. Ask the owner to pair the sessions again.`,
    );
  }

  if (text === "") {
    return refused("Write the text of the note.");
  }

  const [first, second] = pair.sides;
  const [sender, receiver] = first.keyHash === hash ? [first, second] : [second, first];
  const open = await openRecord({ paths, id: receiver.session });

  if (open.kind === "refused") {
    return open;
  }

  const sent = pair.sent + 1;

  await writePairs({
    paths,
    pairs: pairs.map((entry) => (entry.id === pair.id ? { ...entry, sent } : entry)),
  });

  const delivery = await deliver({
    paths,
    record: open.record,
    message: { kind: "peer", pair: pair.id, session: sender.session, text },
    typeText: context.typeText,
    now: context.now(),
  });

  return { kind: "sent", to: receiver.session, left: pairNoteLimit - sent, delivery };
}

