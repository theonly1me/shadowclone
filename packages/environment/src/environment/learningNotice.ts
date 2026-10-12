import path from "node:path";
import { z } from "zod";
import { readLocalText, replaceLocalText, type ProjectPaths } from "@shadowclone/core";

const noticeSchema = z.strictObject({
  applied: z.array(z.string()),
  discarded: z.array(z.string()),
  revisions: z.array(z.string()),
  deliveredAt: z.number().nullable(),
});

type LearningNotice = z.infer<typeof noticeSchema>;

const maximumNamedTitles = 3;

function noticeFile(paths: ProjectPaths): string {
  return path.join(paths.shadowcloneDirectory, "learning-notice.json");
}

function parseNotice(text: string): LearningNotice | null {
  try {
    const parsed = noticeSchema.safeParse(JSON.parse(text));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function readNotice(paths: ProjectPaths): Promise<{ readonly text: string | null; readonly notice: LearningNotice | null }> {
  const text = await readLocalText(noticeFile(paths));

  return { text, notice: text === null ? null : parseNotice(text) };
}

function namedTitles(titles: readonly string[]): string {
  const named = titles.slice(0, maximumNamedTitles).map((title) => `"${title.slice(0, 80)}"`).join(", ");

  return titles.length > maximumNamedTitles ? `${named}, and ${titles.length - maximumNamedTitles} more` : named;
}

export async function recordLearningNotice(options: {
  readonly paths: ProjectPaths;
  readonly applied: readonly string[];
  readonly discarded: readonly string[];
  readonly revisions: readonly string[];
}): Promise<void> {
  const { text, notice } = await readNotice(options.paths);
  const undelivered = notice?.deliveredAt === null ? notice : null;
  const next: LearningNotice = {
    applied: [...(undelivered?.applied ?? []), ...options.applied],
    discarded: [...(undelivered?.discarded ?? []), ...options.discarded],
    revisions: [...(undelivered?.revisions ?? []), ...options.revisions],
    deliveredAt: null,
  };

  await replaceLocalText({ filePath: noticeFile(options.paths), previous: text, next: `${JSON.stringify(next, null, 2)}\n` });
}

export async function takeLearningNotice(paths: ProjectPaths): Promise<string> {
  const { text, notice } = await readNotice(paths);

  if (notice === null || notice.deliveredAt !== null) {
    return "";
  }

  await replaceLocalText({
    filePath: noticeFile(paths),
    previous: text,
    next: `${JSON.stringify({ ...notice, deliveredAt: Date.now() }, null, 2)}\n`,
  });

  return [
    "Shadowclone triaged learned rules after the last session.",
    notice.applied.length > 0 ? `It applied ${notice.applied.length}: ${namedTitles(notice.applied)}.` : "",
    notice.discarded.length > 0 ? `It discarded ${notice.discarded.length} duplicate or covered rule(s): ${namedTitles(notice.discarded)}.` : "",
    "Tell the user once in your first reply.",
    `They can review the changes with \`shadowclone history\` and reverse one with \`shadowclone undo <revision>\`${notice.revisions.length > 0 ? ` (revisions ${notice.revisions.join(", ")})` : ""}.`,
  ].filter((line) => line.length > 0).join(" ");
}
