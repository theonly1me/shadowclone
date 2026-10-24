import type { LivePaths } from "./paths";
import type { LiveRecord } from "./record";
import { appendInbox, type InboxMessage } from "./store";
import type { TypeText } from "./terminal";
import { typeInbox } from "./typing";

export type LiveDelivery = { readonly kind: "typed" | "queued"; readonly detail: string };

export async function deliver(options: {
  readonly paths: LivePaths;
  readonly record: LiveRecord;
  readonly message: InboxMessage;
  readonly typeText: TypeText;
  readonly now: Date;
}): Promise<LiveDelivery> {
  const { paths, record, now } = options;

  await appendInbox({ paths, id: record.id, message: options.message, now });

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

  const typing = await typeInbox({
    paths,
    id: record.id,
    surface: record.surface,
    typeText: options.typeText,
    now,
  });

  if (typing !== "kept") {
    return {
      kind: "typed",
      detail: `shadowclone typed it into the ${record.surface.kind} terminal of the session.`,
    };
  }

  return {
    kind: "queued",
    detail: `${record.surface.kind} refused the input, so your message waits for the next turn of the session.`,
  };
}
