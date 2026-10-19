import { liveOwnerMessage } from "./messages";
import type { LivePaths } from "./paths";
import type { Surface } from "./record";
import { appendInbox, takeInbox } from "./store";
import { oneLine, type TypeText } from "./terminal";

export async function typeInbox(options: {
  readonly paths: LivePaths;
  readonly id: string;
  readonly surface: Surface;
  readonly typeText: TypeText;
  readonly now: Date;
}): Promise<"typed" | "kept" | "empty"> {
  const { paths, id } = options;
  const pending = await takeInbox({ paths, id });

  if (pending.length === 0) {
    return "empty";
  }

  if (
    await options.typeText({ surface: options.surface, text: oneLine(liveOwnerMessage(pending)) })
  ) {
    return "typed";
  }

  for (const message of pending) {
    await appendInbox({ paths, id, text: message, now: options.now });
  }

  return "kept";
}
