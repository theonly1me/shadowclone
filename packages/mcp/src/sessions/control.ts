import type { z } from "zod";
import { sendText, startText, stopText, type CloneNode } from "@shadowclone/clones";
import { liveAnswerText, liveIdPattern, liveSendText, type LiveSessions } from "@shadowclone/live";
import type { cloneInputSchema } from "../sessionsTools";

const liveOperations =
  "A live session takes send with text, or answer with the id of its open question and text. Stop it in its own terminal.";

const noLiveSession = (id: string) =>
  ({ kind: "refused", reason: `No live session ${id} exists on this machine.` }) as const;

async function controlLive(options: {
  readonly live?: LiveSessions;
  readonly input: z.infer<typeof cloneInputSchema>;
  readonly id: string;
}): Promise<{ readonly value: string; readonly isError: boolean }> {
  const { live, input, id } = options;

  if (input.operation === "send" && input.text !== undefined) {
    const outcome = (await live?.send({ id, text: input.text })) ?? noLiveSession(id);

    return { value: liveSendText({ id, outcome }), isError: outcome.kind === "refused" };
  }

  if (input.operation === "answer" && input.text !== undefined && input.question !== undefined) {
    const outcome =
      (await live?.answer({ id, question: input.question, text: input.text })) ?? noLiveSession(id);

    return { value: liveAnswerText({ id, outcome }), isError: outcome.kind === "refused" };
  }

  return { value: liveOperations, isError: true };
}

export async function controlClone(options: {
  readonly node: CloneNode;
  readonly live?: LiveSessions;
  readonly input: z.infer<typeof cloneInputSchema>;
}): Promise<{ readonly value: string; readonly isError: boolean }> {
  const { node, input } = options;

  if (input.id !== undefined && liveIdPattern.test(input.id)) {
    return controlLive({ ...options, id: input.id });
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
