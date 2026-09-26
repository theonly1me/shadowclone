import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { readBoundedFile } from "../../io/files";
import type { ProjectPaths } from "../../paths";
import { resolveRedacted } from "../../redact";
import type { ClaudeMemoryFile, ClaudeMemoryKind } from "./types";

export const maximumClaudeMemoryFiles = 256;
export const maximumClaudeMemoryBytes = 2 * 1024 * 1024;

export function claudeMemoryDirectory(options: {
  readonly paths: ProjectPaths;
  readonly repositoryRoot: string;
}): string {
  const encoded = path.resolve(options.repositoryRoot).replaceAll(/[^a-zA-Z0-9]/g, "-");
  return path.join(options.paths.claudeProjectsDirectory, encoded, "memory");
}

const memoryTypes: readonly ClaudeMemoryKind[] = ["user", "feedback", "reference", "project"];

function kindFromFilename(filename: string): ClaudeMemoryKind | null {
  if (filename === "MEMORY.md") return "index";
  if (filename.startsWith("user_") && filename.endsWith(".md")) return "user";
  if (filename.startsWith("feedback_") && filename.endsWith(".md")) return "feedback";
  if (filename.startsWith("reference_") && filename.endsWith(".md")) return "reference";
  if (filename.startsWith("project_") && filename.endsWith(".md")) return "project";
  return null;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function field(frontmatter: string, name: string): string {
  const prefix = `${name}:`;
  const line = frontmatter.split("\n").find((entry) => entry.startsWith(prefix));
  return line === undefined ? "" : unquote(line.slice(prefix.length));
}

function kindFromType(type: string): ClaudeMemoryKind | null {
  return memoryTypes.find((memoryType) => memoryType === type) ?? null;
}

function contentParts(text: string): {
  readonly name: string;
  readonly description: string;
  readonly modified: string;
  readonly type: string;
  readonly body: string;
} {
  const match = text.match(/^---\n([\s\S]*?)\n---\n(?:\n)?([\s\S]*)$/);
  if (!match?.[1] || match[2] === undefined) {
    return { name: "", description: "", modified: "", type: "", body: text.trim() };
  }
  return {
    name: field(match[1], "name"),
    description: field(match[1], "description"),
    modified: field(match[1], "  modified"),
    type: field(match[1], "type") || field(match[1], "  type"),
    body: match[2].trim(),
  };
}

export async function scanClaudeMemory(options: {
  readonly paths: ProjectPaths;
  readonly repositoryRoot: string;
}): Promise<readonly ClaudeMemoryFile[]> {
  return scanClaudeMemoryDirectory(claudeMemoryDirectory(options));
}

export async function scanClaudeMemoryDirectory(
  directory: string,
): Promise<readonly ClaudeMemoryFile[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  if (entries.some((entry) => entry.isSymbolicLink())) {
    throw new Error("Claude memory contains a symbolic link");
  }
  if (entries.some((entry) => !entry.isFile() || !entry.name.endsWith(".md"))) {
    throw new Error("Claude memory contains an unsupported file");
  }
  const markdown = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"));
  if (markdown.length > maximumClaudeMemoryFiles) {
    throw new Error("Claude memory exceeds the 256-file migration limit");
  }
  const files: ClaudeMemoryFile[] = [];
  let totalBytes = 0;
  for (const entry of markdown.sort((left, right) => left.name.localeCompare(right.name))) {
    const sourcePath = path.join(directory, entry.name);
    const metadata = await lstat(sourcePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("Claude memory contains an unsupported file");
    }
    totalBytes += metadata.size;
    if (totalBytes > maximumClaudeMemoryBytes) {
      throw new Error("Claude memory exceeds the 2 MiB migration limit");
    }
    const raw = await readBoundedFile({
      filePath: sourcePath,
      roots: [directory],
      maximumBytes: maximumClaudeMemoryBytes,
    });
    if (raw === null) throw new Error("Claude memory changed during migration scan");
    const hash = new Bun.CryptoHasher("sha256").update(raw).digest("hex");
    const redacted = await resolveRedacted({
      ref: {
        type: "file",
        sourcePath,
        byteOffset: 0,
        byteLength: metadata.size,
        contentHash: hash,
      },
      roots: [directory],
    });
    const { type, ...parts } = contentParts(redacted);
    const fileKind = kindFromFilename(entry.name) ?? kindFromType(type);
    if (fileKind === null) throw new Error("Claude memory contains a file without a known memory type");
    files.push({
      filename: entry.name,
      sourcePath,
      kind: fileKind,
      hash,
      bytes: metadata.size,
      ...parts,
    });
  }
  return files;
}
