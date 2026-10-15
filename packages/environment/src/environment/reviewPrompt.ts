import path from "node:path";
import { z } from "zod";
import { fingerprint, readLocalText, replaceLocalText, type ProjectPaths } from "@shadowclone/core";
import { listSkillProposals } from "@shadowclone/skills";
import { pendingLearningRecords } from "./pending";
import { readEnvironment } from "./store";

const statusesThatNeedTheUser: ReadonlySet<string> = new Set(["pending", "conflicting-evidence", "retirement-review"]);
const shownSchema = z.strictObject({ fingerprint: z.string() });

function shownFile(paths: ProjectPaths): string {
  return path.join(paths.shadowcloneDirectory, "review-notice.json");
}

function shownFingerprint(text: string | null): string | null {
  if (text === null) return null;

  try {
    const parsed = shownSchema.safeParse(JSON.parse(text));

    return parsed.success ? parsed.data.fingerprint : null;
  } catch {
    return null;
  }
}

export async function takeReviewPrompt(paths: ProjectPaths): Promise<string> {
  const state = await readEnvironment(paths);
  const learnings = state === null ? [] : pendingLearningRecords({ paths, state })
    .filter((entry) => statusesThatNeedTheUser.has(entry.status))
    .map((entry) => `learning:${entry.key}:${entry.status}`);
  const proposals = (await listSkillProposals(paths))
    .filter(({ status }) => status === "pending")
    .map(({ id }) => `proposal:${id}`);
  const waiting = [...new Set([...learnings, ...proposals])].sort();

  if (waiting.length === 0) {
    return "";
  }

  const current = fingerprint(JSON.stringify(waiting));
  const filePath = shownFile(paths);
  const previous = await readLocalText(filePath);

  if (shownFingerprint(previous) === current) {
    return "";
  }

  await replaceLocalText({ filePath, previous, next: `${JSON.stringify({ fingerprint: current })}\n` });

  return [
    `shadowclone has ${waiting.length} proposal(s) that need the user's decision.`,
    "Do not mention them while the user's task is in progress.",
    "When the task is done, load the shadowclone-context skill and follow its steps to review proposals.",
  ].join(" ");
}
