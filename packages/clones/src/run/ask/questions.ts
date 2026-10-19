import { appendFile } from "node:fs/promises";
import { askedQuestionSchema, type AskedQuestion } from "../../node/progress";

export const questionsFileVariable = "SHADOWCLONE_QUESTIONS_FILE";

export async function readAskedQuestions(file: string): Promise<readonly AskedQuestion[]> {
  const handle = Bun.file(file);

  if (!(await handle.exists())) {
    return [];
  }

  return (await handle.text())
    .split("\n")
    .slice(0, -1)
    .flatMap((line) => {
      try {
        const parsed = askedQuestionSchema.safeParse(JSON.parse(line));

        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
}

export function newQuestionId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

  return `q${Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (byte) => alphabet[byte % alphabet.length],
  ).join("")}`;
}

export async function appendAskedQuestion(options: {
  readonly file: string;
  readonly question: AskedQuestion;
}): Promise<void> {
  await appendFile(
    options.file,
    `${JSON.stringify(askedQuestionSchema.parse(options.question))}\n`,
    { mode: 0o600 },
  );
}
