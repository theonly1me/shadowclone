import type { LiveAnswerOutcome } from "./questionAnswer";
import type { LiveAskOutcome } from "./questions";
import type { LiveQuestion } from "./questionStore";

export function liveQuestionLines(question: LiveQuestion): readonly string[] {
  return [
    `Open question ${question.id}: ${question.text}`,
    ...question.options.map((option, index) => `Option ${index + 1}: ${option}`),
    `Recommended: ${question.recommended}`,
  ];
}

export function liveAskText(outcome: LiveAskOutcome): string {
  switch (outcome.kind) {
    case "refused":
      return outcome.reason;
    case "answered":
      return [
        `The owner answered question ${outcome.question.id}.`,
        "<owner-message>",
        outcome.answer,
        "</owner-message>",
        "Follow the answer, then continue.",
      ].join("\n");
    case "expired":
      return `The owner did not answer question ${outcome.question.id} in time. It stays open on the session board. End your turn now. Write the question and its options as your last message, and do not take an option. The answer arrives as a message from the owner.`;
    case "closed":
      return `Question ${outcome.question.id} closed without an answer. Do not take an option. End your turn with the question if you still need the decision.`;
  }
}

export function liveAnswerText(options: {
  readonly id: string;
  readonly outcome: LiveAnswerOutcome;
}): string {
  const { outcome } = options;

  switch (outcome.kind) {
    case "refused":
      return outcome.reason;
    case "returned":
      return `Live session ${options.id} got your answer, and continues.`;
    case "delivered":
      return `${outcome.delivery.kind === "typed" ? "Sent" : "Queued"} your answer for live session ${options.id}, because it no longer waited. ${outcome.delivery.detail}`;
  }
}
