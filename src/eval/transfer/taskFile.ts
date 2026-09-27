import path from "node:path";
import { z } from "zod";
import { materializeSnapshot } from "../../redact";
import { compileCodeRubric } from "./codeRubric";
import { invalidTaskReason } from "./freshTasks";
import { preferenceSources } from "./preferenceRules";
import { fingerprint } from "./structured";
import type { ContextFile, DelegationTask } from "./types";

const taskFileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  tasks: z
    .array(
      z.strictObject({
        prompt: z.string().min(1).max(4000),
        completion: z.array(z.string().min(1).max(1000)).min(1).max(8),
      }),
    )
    .min(1)
    .max(10),
});

export async function prepareTaskFile(options: {
  readonly filePath: string;
  readonly startingCommit: string;
  readonly count: number;
  readonly profile: string;
  readonly context: readonly ContextFile[];
}): Promise<readonly DelegationTask[]> {
  const filePath = path.resolve(options.filePath);

  const snapshot = await materializeSnapshot({
    filePath,
    roots: [filePath],
    maximumBytes: 65536,
    parse: () => null,
  });

  if (snapshot === null) {
    throw new Error("Task file could not be read safely");
  }

  const parsed = taskFileSchema.parse(JSON.parse(snapshot.redacted));

  if (parsed.tasks.length !== options.count) {
    throw new Error("Task file count does not match --tasks");
  }

  if (
    new Set(parsed.tasks.map((task) => task.prompt)).size !==
    parsed.tasks.length
  ) {
    throw new Error("Task file prompts must be distinct");
  }

  const preferences = compileCodeRubric(preferenceSources(options));

  return parsed.tasks.map((task) => {
    const reason = invalidTaskReason({ ...task, preferences, additive: false });

    if (reason) {
      throw new Error(reason);
    }

    return {
      id: fingerprint(task).slice(0, 16),
      startingCommit: options.startingCommit,
      prompt: task.prompt,
      completion: task.completion,
      preferences,
      profile: options.profile,
      profileFingerprint: fingerprint(options.profile),
    };
  });
}
