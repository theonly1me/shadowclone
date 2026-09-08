import { isProfileRelativePath } from "./files";
import { profileImportReferenceSchema } from "./metadata";
import type { ProfileImportReference, ProfileSource } from "./types";

export type GeneratedProfileStateEntry = {
  readonly relativePath: string;
  readonly key: string;
  readonly title: string | null;
  readonly body: string | null;
  readonly source: ProfileSource | null;
  readonly importReference: ProfileImportReference | null;
  readonly disposition: "present" | "retired";
};

export type ProfileRejection = {
  readonly relativePath: string;
  readonly key: string;
  readonly title: string | null;
  readonly body: string | null;
  readonly source: ProfileSource | null;
  readonly importReference: ProfileImportReference | null;
};

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

function legacyIdentity(line: string): {
  readonly relativePath: string;
  readonly key: string;
} | null {
  const [relativePath, key] = line.split("\t");
  return relativePath && key && isProfileRelativePath(relativePath)
    ? { relativePath, key }
    : null;
}

function nullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function parseGeneratedLine(line: string): GeneratedProfileStateEntry | null {
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
      profileImportReferenceSchema.nullable().safeParse(value.importReference).success) &&
    "disposition" in value &&
    (value.disposition === "present" || value.disposition === "retired")
  ) {
    return {
      relativePath: value.relativePath,
      key: value.key,
      title: value.title,
      body: value.body,
      source: value.source,
      importReference: "importReference" in value
        ? profileImportReferenceSchema.nullable().parse(value.importReference)
        : null,
      disposition: value.disposition,
    };
  }
  const legacy = legacyIdentity(line);
  return legacy
    ? {
        ...legacy,
        title: null,
        body: null,
        source: null,
        importReference: null,
        disposition: "present",
      }
    : null;
}

function parseRejectionLine(line: string): ProfileRejection | null {
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
      profileImportReferenceSchema.nullable().safeParse(value.importReference).success)
  ) {
    return {
      relativePath: value.relativePath,
      key: value.key,
      title: value.title,
      body: value.body,
      source: value.source,
      importReference: "importReference" in value
        ? profileImportReferenceSchema.nullable().parse(value.importReference)
        : null,
    };
  }
  const legacy = legacyIdentity(line);
  return legacy
    ? { ...legacy, title: null, body: null, source: null, importReference: null }
    : null;
}

async function stateLines(statePath: string): Promise<readonly string[]> {
  const file = Bun.file(statePath);
  if (!(await file.exists())) {
    return [];
  }
  return (await file.text())
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

export async function readGeneratedProfileState(
  statePath: string,
): Promise<readonly GeneratedProfileStateEntry[]> {
  const entries: GeneratedProfileStateEntry[] = [];
  for (const line of await stateLines(statePath)) {
    const entry = parseGeneratedLine(line);
    if (!entry) {
      throw new Error("Generated profile state contains an invalid entry");
    }
    entries.push(entry);
  }
  return entries;
}

export async function readProfileRejections(
  statePath: string,
): Promise<readonly ProfileRejection[]> {
  const entries: ProfileRejection[] = [];
  for (const line of await stateLines(statePath)) {
    const entry = parseRejectionLine(line);
    if (!entry) {
      throw new Error("Profile rejection state contains an invalid entry");
    }
    entries.push(entry);
  }
  return entries;
}

export function profileRejectionFromState(
  entry: GeneratedProfileStateEntry,
): ProfileRejection {
  return {
    relativePath: entry.relativePath,
    key: entry.key,
    title: entry.title,
    body: entry.body,
    source: entry.source,
    importReference: entry.importReference,
  };
}
