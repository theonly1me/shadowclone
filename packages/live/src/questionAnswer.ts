import { existsSync } from "node:fs";
import { deliver, type LiveDelivery } from "./delivery";
import { liveFile } from "./files";
import { questionAttention, setState, type QuestionContext } from "./questions";
import { claimQuestion, readQuestion, saveAnswer } from "./questionStore";
import type { TypeText } from "./terminal";

export type LiveAnswerOutcome =
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "returned" }
  | { readonly kind: "delivered"; readonly delivery: LiveDelivery };

async function handedOff(options: QuestionContext): Promise<boolean> {
  const file = liveFile({ ...options, kind: "question" });
  const until = Date.now() + options.timing.handoffMilliseconds;

  while (Date.now() < until) {
    await Bun.sleep(options.timing.pollMilliseconds);

    if (!existsSync(file)) {
      return true;
    }
  }

  return false;
}

export async function answerQuestion(
  options: QuestionContext & {
    readonly question: string;
    readonly text: string;
    readonly typeText: TypeText;
  },
): Promise<LiveAnswerOutcome> {
  const open = await readQuestion(options);

  if (open?.id !== options.question || open.answer !== null) {
    return {
      kind: "refused",
      reason: `Live session ${options.id} has no open question ${options.question}. Read the session again for its current question.`,
    };
  }

  if (options.now().getTime() < Date.parse(open.waitUntil)) {
    await saveAnswer({ ...options, question: { ...open, answer: options.text } });

    if (await handedOff(options)) {
      return { kind: "returned" };
    }
  }

  if ((await claimQuestion(options)) === null) {
    return { kind: "returned" };
  }

  const record = await setState({
    ...options,
    change: (current) =>
      current.state === "needs-you" && current.attention === questionAttention(open)
        ? { ...current, state: "idle", attention: null }
        : null,
  });

  if (record === null || record.state === "ended") {
    return { kind: "refused", reason: `Live session ${options.id} already ended.` };
  }

  const delivery = await deliver({
    paths: options.paths,
    record,
    message: { kind: "owner", text: `Answer to your question "${open.text}": ${options.text}` },
    typeText: options.typeText,
    now: options.now(),
  });

  return { kind: "delivered", delivery };
}
