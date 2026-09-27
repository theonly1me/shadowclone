import path from "node:path";
import { z } from "zod";
import type { ContextFile } from "./types";

const metadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export function renderSkillCatalog(files: readonly ContextFile[]): string {
  const entries = files
    .filter((file) => file.relativePath.endsWith("/SKILL.md"))
    .map((file) => {
      const match = file.content.match(
        /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
      );
      let value: unknown;

      try {
        value = match?.[1] ? Bun.YAML.parse(match[1]) : null;
      } catch {
        value = null;
      }

      const parsed = metadataSchema.safeParse(value);

      return {
        name: parsed.success
          ? parsed.data.name
          : path.basename(path.dirname(file.relativePath)),
        description: parsed.success
          ? parsed.data.description
          : "Description unavailable; inspect this skill when relevant.",
        path: `.eval-context/${file.relativePath}`,
      };
    });

  return entries.length === 0
    ? ""
    : [
        "Available personal skills (metadata only; read selected SKILL.md files for their instructions):",
        "Select relevant skills by their descriptions, including any mandatory skill, before working.",
        JSON.stringify(entries),
      ].join("\n");
}
