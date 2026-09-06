import os from "node:os";
import { Database } from "bun:sqlite";
import type { TextRef } from "../observe";
import { redactionRules } from "./rules";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceHomeDirectory(options: {
  readonly text: string;
  readonly homeDirectory: string;
}): string {
  if (options.homeDirectory.length === 0) {
    return options.text;
  }
  const escaped = escapeRegExp(options.homeDirectory);
  const filePrefix = ["file:", "", ""].join("/");
  const unslashed = escaped.startsWith("/") ? escaped.slice(1) : escaped;
  const fileUrlPattern = new RegExp(
    `(${filePrefix}/?)${unslashed}(?=[/\\\\\\s"'\\),]|$)`,
    "gm",
  );
  const pattern = new RegExp(
    `(^|[\\s"'\\(=:,])${escaped}(?=[/\\\\\\s"'\\),]|$)`,
    "gm",
  );
  return options.text
    .replace(fileUrlPattern, "$1~")
    .replace(pattern, "$1~");
}

export function redactSecrets(options: {
  readonly text: string;
  readonly homeDirectory?: string;
}): string {
  const homeDirectory = options.homeDirectory ?? os.homedir();

  let redacted = homeDirectory
    ? replaceHomeDirectory({ text: options.text, homeDirectory })
    : options.text;
  for (const rule of redactionRules) {
    redacted = redacted.replace(rule.pattern, rule.replace);
  }

  return redacted;
}

export const redactionLabels: readonly string[] = redactionRules.map(
  (rule) => rule.label,
);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function selectJson(options: {
  readonly value: unknown;
  readonly path: readonly (string | number)[];
}): unknown {
  let selected = options.value;
  for (const part of options.path) {
    if (typeof part === "number") {
      if (!Array.isArray(selected)) {
        return null;
      }
      selected = selected[part];
      continue;
    }
    if (!isRecord(selected)) {
      return null;
    }
    selected = selected[part];
  }
  return selected;
}

function unwrapText(options: {
  readonly text: string;
  readonly unwrap: "user-query" | null;
}): string {
  if (options.unwrap === null) {
    return options.text;
  }
  const match = options.text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
  return match?.[1] ?? "";
}

async function resolveSqliteText(
  ref: Extract<TextRef, { readonly type: "sqlite-blob" }>,
): Promise<string> {
  if (!(await Bun.file(ref.sourcePath).exists())) {
    return "";
  }
  let database: Database | null = null;
  try {
    database = new Database(ref.sourcePath, { readonly: true, strict: true });
    const row = database
      .query<{ readonly data: Uint8Array }, [string]>(
        "SELECT data FROM blobs WHERE id = ?",
      )
      .get(ref.blobId);
    if (row === null) {
      return "";
    }
    const value: unknown = JSON.parse(new TextDecoder().decode(row.data));
    const selected = selectJson({ value, path: ref.jsonPath });
    return typeof selected === "string"
      ? unwrapText({ text: selected, unwrap: ref.unwrap })
      : "";
  } catch {
    return "";
  } finally {
    database?.close();
  }
}

export async function resolveRedacted(options: {
  readonly ref: TextRef;
}): Promise<string> {
  if (options.ref.type === "sqlite-blob") {
    const text = await resolveSqliteText(options.ref);
    return redactSecrets({ text });
  }
  const file = Bun.file(options.ref.sourcePath);
  if (
    !(await file.exists()) ||
    file.size < options.ref.byteOffset + options.ref.byteLength
  ) {
    return "";
  }

  const text = await file
    .slice(
      options.ref.byteOffset,
      options.ref.byteOffset + options.ref.byteLength,
    )
    .text();
  return redactSecrets({ text });
}
