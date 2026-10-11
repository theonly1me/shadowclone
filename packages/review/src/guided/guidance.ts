import { readBoundedFile, canonicalPath } from "@shadowclone/core";
import path from "node:path";

export async function readGuidedVoice(options: {
  readonly voiceFile?: string;
  readonly reviewSkill?: string;
}): Promise<string> {
  const parts: string[] = [];
  for (const file of [options.voiceFile, options.reviewSkill]) {
    if (!file) continue;
    const absolute = canonicalPath(file);
    const text = await readBoundedFile({
      filePath: absolute,
      roots: [path.dirname(absolute)],
      maximumBytes: 64_000,
    });
    if (text === null)
      throw new Error("Selected voice or review guidance cannot be read within its file boundary.");
    parts.push(text);
  }
  return parts.length
    ? parts.join("\n\n")
    : "Preserve the user's rough wording and intent. Use plain, concise English. No personal voice profile was supplied.";
}
