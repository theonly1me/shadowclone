import { existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

export const maximumGuidanceFiles = 256;
export const maximumGuidanceBytes = 2_000_000;

export type RepositoryGuidanceSource = {
  readonly relativePath: string;
  readonly filePath: string;
  readonly byteLength: number;
  readonly kind: "instructions" | "skill";
};

const rootFiles = ["AGENTS.md", "CLAUDE.md", ".cursorrules"] as const;
const skillRoots = [
  [".agents", "skills"],
  [".claude", "skills"],
] as const;

async function supportedFile(options: {
  readonly filePath: string;
  readonly relativePath: string;
  readonly kind: RepositoryGuidanceSource["kind"];
}): Promise<RepositoryGuidanceSource | null> {
  if (!existsSync(options.filePath)) {
    return null;
  }
  try {
    const metadata = await lstat(options.filePath);
    if (!metadata.isFile()) {
      throw new Error("Repository guidance contains an unsupported entry");
    }
    return metadata.size === 0
      ? null
      : {
          relativePath: options.relativePath,
          filePath: options.filePath,
          byteLength: metadata.size,
          kind: options.kind,
        };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Repository guidance")) {
      throw error;
    }
    throw new Error("Repository guidance could not be inspected");
  }
}

async function rootGuidance(
  workingDirectory: string,
): Promise<readonly RepositoryGuidanceSource[]> {
  const sources = await Promise.all(
    rootFiles.map((filename) =>
      supportedFile({
        filePath: path.join(workingDirectory, filename),
        relativePath: filename,
        kind: "instructions",
      }),
    ),
  );
  return sources.filter((source) => source !== null);
}

async function skillGuidance(options: {
  readonly workingDirectory: string;
  readonly root: readonly [string, string];
}): Promise<readonly RepositoryGuidanceSource[]> {
  const rootPath = path.join(options.workingDirectory, ...options.root);
  if (!existsSync(rootPath)) {
    return [];
  }
  let entries: readonly Dirent[];
  try {
    const metadata = await lstat(rootPath);
    if (!metadata.isDirectory()) {
      throw new Error("Repository skill root is not a directory");
    }
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Repository skill")) {
      throw error;
    }
    throw new Error("Repository skill root could not be inspected");
  }
  const sources: RepositoryGuidanceSource[] = [];
  for (const entry of entries) {
    if (entry.name === "shadowclone") {
      continue;
    }
    if (entry.isSymbolicLink()) {
      throw new Error("Repository guidance contains a symbolic link");
    }
    if (!entry.isDirectory()) {
      continue;
    }
    const segments = [...options.root, entry.name, "SKILL.md"];
    const source = await supportedFile({
      filePath: path.join(options.workingDirectory, ...segments),
      relativePath: segments.join("/"),
      kind: "skill",
    });
    if (source !== null) {
      sources.push(source);
    }
  }
  return sources;
}

export async function discoverRepositoryGuidance(
  workingDirectory: string,
): Promise<readonly RepositoryGuidanceSource[]> {
  const skillSources = await Promise.all(
    skillRoots.map((root) => skillGuidance({ workingDirectory, root })),
  );
  const sources = [
    ...await rootGuidance(workingDirectory),
    ...skillSources.flat(),
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const totalBytes = sources.reduce(
    (total, source) => total + source.byteLength,
    0,
  );
  if (sources.length > maximumGuidanceFiles) {
    throw new Error("Repository guidance exceeds the supported file count");
  }
  if (totalBytes > maximumGuidanceBytes) {
    throw new Error("Repository guidance exceeds the supported byte limit");
  }
  return sources;
}
