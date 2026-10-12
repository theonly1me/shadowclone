import { parseRejectionLine } from "./stateParsing";
import type { ProfileImportReference, ProfileSource } from "./types";
import type { ProfileRejectionReason } from "./rejection";

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
  readonly reason?: ProfileRejectionReason | null;
};

export type { ProfileRejectionReason } from "./rejection";

export function parseProfileRejectionText(
  text: string,
): readonly ProfileRejection[] {
  const entries: ProfileRejection[] = [];

  for (const line of text
    .split("\n")
    .filter((value) => value.trim().length > 0)) {
    const entry = parseRejectionLine(line);

    if (!entry) {
      throw new Error("Profile rejection state contains an invalid entry");
    }

    entries.push(entry);
  }

  return entries;
}
