import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { OriginScope } from "../signal";
import { parseProfileBlocks } from "./parse";

type CompiledBlock = {
  readonly content: string;
  readonly observations: number;
  readonly active: boolean;
};

function toCompiledBlock(
  block: ReturnType<typeof parseProfileBlocks>[number],
): CompiledBlock {
  return {
    content: block.content
      .replace(/\n\n<!-- shadowclone: [^\n]+ -->\s*$/, "")
      .trim(),
    observations:
      block.key === null ? Number.MAX_SAFE_INTEGER : block.observations,
    active: block.status === "active",
  };
}

async function markdownFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  const glob = new Bun.Glob("**/*.md");
  try {
    for await (const filePath of glob.scan({
      cwd: directory,
      absolute: true,
      onlyFiles: true,
    })) {
      files.push(filePath);
    }
  } catch {
    return [];
  }
  return files.sort();
}

function allowedProjectFile(options: {
  readonly filePath: string;
  readonly targetRepo: string | null;
}): boolean {
  const normalized = options.filePath.split(path.sep).join("/");
  if (!normalized.includes("/projects/")) {
    return true;
  }
  return (
    options.targetRepo !== null &&
    normalized.endsWith(`/projects/${options.targetRepo}.md`)
  );
}

export async function buildCompiledProfile(options: {
  readonly profileDirectory: string;
  readonly origin: OriginScope;
  readonly targetRepo?: string | null;
}): Promise<string> {
  const directories = [
    path.join(options.profileDirectory, "global"),
    path.join(options.profileDirectory, "org", options.origin.directoryName),
  ];
  const filePaths = (
    await Promise.all(directories.map(markdownFiles))
  ).flat();
  const blocks: CompiledBlock[] = [];

  for (const filePath of filePaths) {
    if (
      !allowedProjectFile({
        filePath,
        targetRepo: options.targetRepo ?? null,
      })
    ) {
      continue;
    }
    const text = await Bun.file(filePath).text();
    blocks.push(...parseProfileBlocks(text).map(toCompiledBlock));
  }

  const selected = blocks
    .filter((block) => block.active)
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        left.content.localeCompare(right.content),
    );
  return selected.length === 0
    ? "# Shadowclone profile\n"
    : `# Shadowclone profile\n\n${selected
        .map((block) => block.content)
        .join("\n\n")}\n`;
}

export async function compileProfile(options: {
  readonly profileDirectory: string;
  readonly outputPath: string;
  readonly origin: OriginScope;
  readonly targetRepo?: string | null;
}): Promise<string> {
  const profile = await buildCompiledProfile(options);
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await Bun.write(options.outputPath, profile);
  return profile;
}
