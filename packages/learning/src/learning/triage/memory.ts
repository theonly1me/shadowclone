import path from "node:path";
import { z } from "zod";
import { readLocalText, replaceLocalText, type ProjectPaths } from "@shadowclone/core";

const memorySchema = z.strictObject({
  deferred: z.record(z.string(), z.string()),
});

export type TriageMemory = z.infer<typeof memorySchema>;

function memoryFile(paths: ProjectPaths): string {
  return path.join(paths.shadowcloneDirectory, "learning-triage.json");
}

export async function readTriageMemory(paths: ProjectPaths): Promise<TriageMemory> {
  const text = await readLocalText(memoryFile(paths));

  return text === null ? { deferred: {} } : memorySchema.parse(JSON.parse(text));
}

export async function writeTriageMemory(options: {
  readonly paths: ProjectPaths;
  readonly memory: TriageMemory;
}): Promise<void> {
  const filePath = memoryFile(options.paths);

  await replaceLocalText({
    filePath,
    previous: await readLocalText(filePath),
    next: `${JSON.stringify(options.memory, null, 2)}\n`,
  });
}
