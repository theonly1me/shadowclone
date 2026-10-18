import type { ClonesPaths } from "../config/store";
import { appendInbox } from "./inbox";
import { cloneState, cloneView, isActive, openQuestion, type CloneView } from "./record";
import { readRun } from "./store";

export type SendOutcome =
  | { readonly kind: "sent"; readonly clone: CloneView }
  | { readonly kind: "refused"; readonly reason: string };

export async function sendToClone(options: {
  readonly paths: ClonesPaths;
  readonly id: string;
  readonly now: Date;
  readonly message:
    { readonly text: string } | { readonly question: string; readonly text: string };
}): Promise<SendOutcome> {
  const { paths, id, message } = options;
  const run = await readRun({ paths, id });

  if (run === null) {
    return { kind: "refused", reason: `No clone ${id} exists on this machine.` };
  }

  if (!isActive(run)) {
    return { kind: "refused", reason: `Clone ${id} already ended: ${cloneState(run)}.` };
  }

  if ("question" in message && openQuestion({ run, question: message.question }) === null) {
    return { kind: "refused", reason: `Clone ${id} has no open question ${message.question}.` };
  }

  await appendInbox({
    paths,
    id,
    entry:
      "question" in message
        ? {
            kind: "answer",
            at: options.now.toISOString(),
            question: message.question,
            text: message.text,
          }
        : { kind: "message", at: options.now.toISOString(), text: message.text },
  });

  return { kind: "sent", clone: cloneView(run) };
}
