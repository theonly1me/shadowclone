import type { z } from "zod";
import { sendText, startText, stopText, type CloneNode } from "@shadowclone/clones";
import { liveIdPattern, liveSendText, type LiveSessions } from "@shadowclone/live";
import type { cloneInputSchema } from "../sessionsTools";

const liveOnlySend = "A live session takes only send. Answer or stop it in its own terminal.";

export async function controlClone(options: {
  readonly node: CloneNode;
  readonly live?: LiveSessions;
  readonly input: z.infer<typeof cloneInputSchema>;
}): Promise<{ readonly value: string; readonly isError: boolean }> {
  const { node, input } = options;

  if (input.id !== undefined && liveIdPattern.test(input.id)) {
    if (input.operation !== "send" || input.text === undefined) {
      return { value: liveOnlySend, isError: true };
    }

    const outcome = (await options.live?.send({ id: input.id, text: input.text })) ?? {
      kind: "refused",
      reason: `No live session ${input.id} exists on this machine.`,
    };

    return { value: liveSendText({ id: input.id, outcome }), isError: outcome.kind === "refused" };
  }

  if (input.operation === "send" || input.operation === "answer") {
    if (input.id === undefined || input.text === undefined) {
      throw new Error("Name the clone id and give the owner's text.");
    }

    if (input.operation === "answer" && input.question === undefined) {
      throw new Error("Name the question id from shadowclone_sessions get.");
    }

    const outcome =
      input.operation === "send"
        ? await node.send({ id: input.id, text: input.text })
        : await node.answer({ id: input.id, question: input.question ?? "", text: input.text });

    return {
      value: sendText({ outcome, what: input.operation === "send" ? "message" : "answer" }),
      isError: outcome.kind === "refused",
    };
  }

  if (input.operation === "stop") {
    if (input.id === undefined) {
      throw new Error("Name the clone id from shadowclone_sessions list.");
    }

    const outcome = await node.stop(input.id);

    return { value: stopText({ id: input.id, outcome }), isError: outcome.kind === "unknown" };
  }

  if (input.repository === undefined) {
    throw new Error("Name the repository as owner/repository.");
  }

  const outcome = await node.start({
    repository: input.repository,
    task: input.task,
    ...(input.issue === undefined ? {} : { issue: input.issue }),
    ...(input.pull === undefined ? {} : { pull: input.pull }),
    review: input.review,
  });

  return { value: startText(outcome), isError: outcome.kind === "refused" };
}
