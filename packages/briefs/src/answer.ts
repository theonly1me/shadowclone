import { redactSecrets } from "@shadowclone/redact";
import type { LiveBrief } from "@shadowclone/live";
import { briefAnswerSchema } from "./request";

export const briefFieldLimits = {
  name: 60,
  goal: 300,
  done: 300,
  question: 500,
  option: 80,
} as const;

function bounded(options: { readonly text: string; readonly limit: number }): string {
  const redacted = redactSecrets({ text: options.text.replaceAll(/\s+/g, " ").trim() });

  return redacted.length <= options.limit ? redacted : `${redacted.slice(0, options.limit - 1)}…`;
}

export function briefFromAnswer(options: {
  readonly answer: unknown;
  readonly messageDigest: string;
  readonly now: Date;
}): LiveBrief | null {
  const parsed = briefAnswerSchema.safeParse(options.answer);

  if (!parsed.success) {
    return null;
  }

  const answer = parsed.data;
  const name = bounded({ text: answer.name, limit: briefFieldLimits.name });

  if (name === "") {
    return null;
  }

  return {
    name,
    goal: bounded({ text: answer.goal, limit: briefFieldLimits.goal }),
    done: bounded({ text: answer.done, limit: briefFieldLimits.done }),
    kind: answer.kind,
    question:
      answer.kind === "question" && answer.question !== null
        ? bounded({ text: answer.question, limit: briefFieldLimits.question })
        : null,
    options: answer.options
      .map((option) => bounded({ text: option, limit: briefFieldLimits.option }))
      .filter((option) => option !== ""),
    messageDigest: options.messageDigest,
    writtenAt: options.now.toISOString(),
  };
}
