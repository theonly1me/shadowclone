import path from "node:path";
import { seedSkillMetadataSchema, type SeedSkill } from "./schema";

const metadataKeys = new Set([
  "id",
  "title",
  "axis",
  "category",
  "section",
  "applies-when",
]);

function validateMetadataKeys(options: {
  readonly filename: string;
  readonly lines: readonly string[];
}): void {
  const seen = new Set<string>();
  for (const line of options.lines) {
    if (line.length === 0 || line.startsWith(" ") || line.startsWith("\t")) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    const key = line.slice(0, separatorIndex);
    if (
      separatorIndex < 1 ||
      !metadataKeys.has(key) ||
      seen.has(key)
    ) {
      throw new Error(`Invalid skill metadata in ${options.filename}`);
    }
    seen.add(key);
  }
}

export function parseSeedSkillDocument(options: {
  readonly filename: string;
  readonly text: string;
}): SeedSkill {
  const lines = options.text.split(/\r?\n/);
  const [opening] = lines;
  const closingIndex = lines.indexOf("---", 1);
  if (opening !== "---" || closingIndex < 2) {
    throw new Error(`Invalid skill frontmatter in ${options.filename}`);
  }

  const metadataLines = lines.slice(1, closingIndex);
  validateMetadataKeys({ filename: options.filename, lines: metadataLines });
  let rawMetadata: unknown;
  try {
    rawMetadata = Bun.YAML.parse(metadataLines.join("\n"));
  } catch {
    throw new Error(`Invalid skill metadata in ${options.filename}`);
  }
  const parsed = seedSkillMetadataSchema.safeParse(rawMetadata);
  if (!parsed.success) {
    throw new Error(`Invalid skill metadata in ${options.filename}`);
  }

  if (path.basename(options.filename) !== `${parsed.data.id}.md`) {
    throw new Error(`Skill filename does not match its id in ${options.filename}`);
  }

  const [heading, ...bodyLines] = lines.slice(closingIndex + 1);
  if (heading !== `## ${parsed.data.title}`) {
    throw new Error(`Skill heading does not match its title in ${options.filename}`);
  }
  const body = bodyLines.join("\n").trim();
  if (body.length === 0) {
    throw new Error(`Skill body is empty in ${options.filename}`);
  }

  return {
    id: parsed.data.id,
    title: parsed.data.title,
    axis: parsed.data.axis,
    category: parsed.data.category,
    section: parsed.data.section,
    appliesWhen: parsed.data["applies-when"],
    body,
  };
}
