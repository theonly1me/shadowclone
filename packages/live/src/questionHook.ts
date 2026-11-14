import type { LivePaths } from "./paths";
import { questionAttention } from "./questions";
import { readQuestion, removeQuestion } from "./questionStore";
import type { LiveRecord } from "./record";

export async function withOpenQuestion(options: {
  readonly paths: LivePaths;
  readonly record: LiveRecord;
  readonly event: string;
  readonly now: Date;
}): Promise<LiveRecord> {
  const { paths, record } = options;
  const question = await readQuestion({ paths, id: record.id });

  if (question === null) {
    return record;
  }

  const ownerTypedAfterWait =
    options.event === "UserPromptSubmit" && options.now.getTime() >= Date.parse(question.waitUntil);

  if (record.state === "ended" || ownerTypedAfterWait) {
    await removeQuestion({ paths, id: record.id });

    return record;
  }

  return record.state === "idle"
    ? { ...record, state: "needs-you", attention: questionAttention(question) }
    : record;
}
