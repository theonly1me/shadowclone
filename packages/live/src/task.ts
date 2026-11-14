import { z } from "zod";
import { liveFile, readJsonFile, writePrivateJson } from "./files";
import { boundedText } from "./messages";
import type { LivePaths } from "./paths";
import { liveIdPattern } from "./board";

export const promptLimit = 2048;

const liveTaskSchema = z.strictObject({
  first: z.string(),
  latest: z.string(),
  updatedAt: z.string(),
});

export type LiveTask = z.infer<typeof liveTaskSchema>;

export async function readTask(options: {
  readonly paths: LivePaths;
  readonly id: string;
}): Promise<LiveTask | null> {
  if (!liveIdPattern.test(options.id)) {
    return null;
  }

  const task = liveTaskSchema.safeParse(await readJsonFile(liveFile({ ...options, kind: "task" })));

  return task.success ? task.data : null;
}

export async function recordPrompt(options: {
  readonly paths: LivePaths;
  readonly id: string;
  readonly prompt: string;
  readonly now: Date;
}): Promise<void> {
  const prompt = boundedText({ text: options.prompt, limit: promptLimit });

  if (prompt === "") {
    return;
  }

  const existing = await readTask(options);

  await writePrivateJson({
    paths: options.paths,
    file: liveFile({ ...options, kind: "task" }),
    value: {
      first: existing?.first ?? prompt,
      latest: prompt,
      updatedAt: options.now.toISOString(),
    } satisfies LiveTask,
  });
}
