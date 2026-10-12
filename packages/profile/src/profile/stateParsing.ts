import type { ProfileRejection } from "./state";
import { isProfileRelativePath } from "./files";
import { profileImportReferenceSchema } from "./metadata";
import type { ProfileSource } from "./types";
import { isRejectionReason } from "./rejection";

function isProfileSource(value: unknown): value is ProfileSource {
  return (
    value === "declared" ||
    value === "imported" ||
    value === "mined" ||
    value === "user"
  );
}

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function nullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function parseRejectionLine(line: string): ProfileRejection | null {
  const value = parseJson(line);

  if (
    typeof value === "object" &&
    value !== null &&
    "schema" in value &&
    value.schema === 1 &&
    "relativePath" in value &&
    typeof value.relativePath === "string" &&
    isProfileRelativePath(value.relativePath) &&
    "key" in value &&
    typeof value.key === "string" &&
    "title" in value &&
    nullableString(value.title) &&
    "body" in value &&
    nullableString(value.body) &&
    "source" in value &&
    (isProfileSource(value.source) || value.source === null) &&
    (!("importReference" in value) ||
      profileImportReferenceSchema.nullable().safeParse(value.importReference)
        .success) &&
    (!("reason" in value) ||
      value.reason === null ||
      isRejectionReason(value.reason))
  ) {
    return {
      relativePath: value.relativePath,
      key: value.key,
      title: value.title,
      body: value.body,
      source: value.source,
      importReference:
        "importReference" in value
          ? profileImportReferenceSchema.nullable().parse(value.importReference)
          : null,
      reason:
        "reason" in value && isRejectionReason(value.reason)
          ? value.reason
          : null,
    };
  }

  return null;
}
