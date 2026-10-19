export function ownerMessageText(text: string): string {
  return [
    "A message from the owner arrived while you worked. Follow it, then continue the task.",
    "<owner-message>",
    text,
    "</owner-message>",
  ].join("\n");
}

export function answerText(options: {
  readonly question: string;
  readonly answer: string;
}): string {
  return [
    `The owner answered your question: ${options.question}`,
    "<owner-answer>",
    options.answer,
    "</owner-answer>",
    "Continue the task with this answer.",
  ].join("\n");
}

export const noAnswerText =
  "No answer arrived within 30 minutes. Take your recommended option where it is safe. Skip each destructive or outward step that needed the owner, and list it in your completion report.";

export const askGuidance = [
  "The owner can send you messages while you work. Follow each message from the owner.",
  "If a decision needs the owner, call the shadowclone_ask tool with your recommended option.",
  "Keep working on the parts that do not depend on the answer.",
  "Do not take a destructive or outward step that a question covers until the answer arrives.",
];
