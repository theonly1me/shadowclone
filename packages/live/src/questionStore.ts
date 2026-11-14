import { link, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { boardQuestionSchema, liveIdPattern } from "./board";
import { ensureDirectory, liveFile, parseJson, readJsonFile, writePrivateJson } from "./files";
import type { LivePaths } from "./paths";

const liveQuestionSchema = boardQuestionSchema.extend({
  askedAt: z.string(),
  waitUntil: z.string(),
  answer: z.string().nullable(),
});

export type LiveQuestion = z.infer<typeof liveQuestionSchema>;

type SessionFile = { readonly paths: LivePaths; readonly id: string };

function questionFile(options: SessionFile): string {
  return liveFile({ ...options, kind: "question" });
}

export function newLiveQuestionId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const characters = Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (byte) => alphabet[byte % alphabet.length],
  );

  return `q${characters.join("")}`;
}

export async function readQuestion(options: SessionFile): Promise<LiveQuestion | null> {
  if (!liveIdPattern.test(options.id)) {
    return null;
  }

  const question = liveQuestionSchema.safeParse(await readJsonFile(questionFile(options)));

  return question.success ? question.data : null;
}

export async function createQuestion(
  options: SessionFile & { readonly question: LiveQuestion },
): Promise<boolean> {
  await ensureDirectory(options.paths);

  const file = questionFile(options);
  const temporary = `${file}.${randomUUID()}.tmp`;

  await writeFile(temporary, `${JSON.stringify(liveQuestionSchema.parse(options.question))}\n`, {
    mode: 0o600,
  });

  try {
    return await link(temporary, file).then(
      () => true,
      () => false,
    );
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function saveAnswer(
  options: SessionFile & { readonly question: LiveQuestion },
): Promise<void> {
  await writePrivateJson({
    paths: options.paths,
    file: questionFile(options),
    value: liveQuestionSchema.parse(options.question),
  });
}

export async function claimQuestion(options: SessionFile): Promise<LiveQuestion | null> {
  const taking = `${questionFile(options)}.${randomUUID()}.taking`;
  const claimed = await rename(questionFile(options), taking).then(
    () => true,
    () => false,
  );

  if (!claimed) {
    return null;
  }

  const text = await readFile(taking, "utf8").catch(() => "");

  await rm(taking, { force: true });

  const question = liveQuestionSchema.safeParse(parseJson(text));

  return question.success ? question.data : null;
}

export async function removeQuestion(options: SessionFile): Promise<void> {
  await rm(questionFile(options), { force: true });
}
