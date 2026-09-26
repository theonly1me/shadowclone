import { stat } from "node:fs/promises";
import path from "node:path";
import { readBoundedFile } from "../io/files";
import { resolveRedacted } from "../redact";
import type { OriginScope } from "../signal";
import { parseReference, renderReference } from "./format";
import { referenceMatchesPath, referenceScopeRoots } from "./paths";
import type { ReferenceSearchResult } from "./types";
import type { ReferenceRecord } from "./types";

export const maximumReferenceBytes = 64 * 1024;

async function resolveSlice(options: {
  readonly filePath: string;
  readonly root: string;
  readonly raw: string;
  readonly start: number;
  readonly end: number;
}): Promise<string> {
  const byteOffset = Buffer.byteLength(options.raw.slice(0, options.start), "utf8");
  const value = options.raw.slice(options.start, options.end);
  const byteLength = Buffer.byteLength(value, "utf8");
  if (byteLength === 0) return "";
  return resolveRedacted({
    ref: {
      type: "file",
      sourcePath: options.filePath,
      byteOffset,
      byteLength,
      contentHash: new Bun.CryptoHasher("sha256").update(value).digest("hex"),
    },
    roots: [options.root],
  });
}

async function redactedField(options: {
  readonly field: string;
  readonly filePath: string;
  readonly root: string;
  readonly raw: string;
}): Promise<unknown> {
  const prefix = `${options.field}: `;
  const start = options.raw.indexOf(prefix);
  if (start < 0) return null;
  const valueStart = start + prefix.length;
  const newline = options.raw.indexOf("\n", valueStart);
  const valueEnd = newline < 0 ? options.raw.length : newline;
  const text = await resolveSlice({ ...options, start: valueStart, end: valueEnd });
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function redactReference(options: {
  readonly record: ReferenceRecord;
  readonly filePath: string;
  readonly root: string;
  readonly raw: string;
}): Promise<ReferenceRecord | null> {
  const fields = await Promise.all(
    ["key", "title", "summary", "tags", "originDirectory", "repositoryName", "sourceLocator", "updatedAt"]
      .map((field) => redactedField({ ...options, field })),
  );
  const [key, title, summary, tags, originDirectory, repositoryName, sourceLocator, updatedAt] = fields;
  const header = options.raw.match(/^---\n[\s\S]*?\n---\n(?:\n)?/);
  if (
    header === null || typeof key !== "string" || typeof title !== "string" ||
    typeof summary !== "string" || !Array.isArray(tags) ||
    !tags.every((tag) => typeof tag === "string") ||
    (originDirectory !== null && typeof originDirectory !== "string") ||
    (repositoryName !== null && typeof repositoryName !== "string") ||
    typeof sourceLocator !== "string" || typeof updatedAt !== "string"
  ) return null;
  const body = (await resolveSlice({
    ...options,
    start: header[0].length,
    end: options.raw.length,
  })).trim();
  const common = {
    schema: 1 as const,
    key,
    title,
    summary,
    tags,
    source: options.record.source,
    sourceLocator,
    updatedAt,
    body,
  };
  if (options.record.scope === "global") {
    if (originDirectory !== null || repositoryName !== null) return null;
    return parseReference(renderReference({
      ...common,
      scope: "global",
      originDirectory: null,
      repositoryName: null,
    }));
  }
  if (options.record.scope === "org") {
    if (originDirectory === null || repositoryName !== null) return null;
    return parseReference(renderReference({
      ...common,
      scope: "org",
      originDirectory,
      repositoryName: null,
    }));
  }
  if (originDirectory === null || repositoryName === null) return null;
  return parseReference(renderReference({
    ...common,
    scope: "project",
    originDirectory,
    repositoryName,
  }));
}

async function readReference(options: {
  readonly profileDirectory: string;
  readonly relativePath: string;
}): Promise<ReferenceSearchResult | null> {
  const filePath = path.join(options.profileDirectory, options.relativePath);
  const size = await stat(filePath).then((value) => value.size).catch(() => 0);
  if (size < 1 || size > maximumReferenceBytes) return null;
  const raw = await readBoundedFile({
    filePath,
    roots: [options.profileDirectory],
    maximumBytes: maximumReferenceBytes,
  });
  if (raw === null) return null;
  const parsed = parseReference(raw);
  if (parsed === null) return null;
  const record = await redactReference({
    record: parsed,
    filePath,
    root: options.profileDirectory,
    raw,
  });
  return record !== null && referenceMatchesPath({ record, relativePath: options.relativePath })
    ? { record, relativePath: options.relativePath }
    : null;
}

async function scopedPaths(options: {
  readonly profileDirectory: string;
  readonly origin: OriginScope | null;
  readonly targetRepo: string | null;
  readonly scope?: "global" | "scoped" | "combined";
}): Promise<readonly string[]> {
  const paths: string[] = [];
  for (const root of referenceScopeRoots(options)) {
    const absoluteRoot = path.join(options.profileDirectory, root);
    const exists = await stat(absoluteRoot)
      .then((value) => value.isDirectory())
      .catch(() => false);
    if (!exists) continue;
    for await (const filePath of new Bun.Glob("*.md").scan({
      cwd: absoluteRoot,
      absolute: true,
      onlyFiles: true,
    })) {
      paths.push(path.relative(options.profileDirectory, filePath));
    }
  }
  return [...new Set(paths)].sort();
}

export async function readScopedReferences(options: {
  readonly profileDirectory: string;
  readonly origin: OriginScope | null;
  readonly targetRepo: string | null;
  readonly scope?: "global" | "scoped" | "combined";
}): Promise<readonly ReferenceSearchResult[]> {
  const results = await Promise.all(
    (await scopedPaths(options)).map((relativePath) =>
      readReference({ profileDirectory: options.profileDirectory, relativePath })
    ),
  );
  return results.filter((result) => result !== null);
}
