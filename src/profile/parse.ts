import { profileFingerprint } from "./render";
import type {
  ExistingProfileBlock,
  ExistingProfileRule,
} from "./types";

function readMetadataValue(options: {
  readonly metadata: string;
  readonly name: string;
}): string | null {
  const values = options.metadata.split(/\s+/);
  const prefix = `${options.name}=`;
  const value = values.find((entry) => entry.startsWith(prefix));
  return value?.slice(prefix.length) ?? null;
}

function parseBlock(block: string): ExistingProfileBlock {
  const metadataMatch = block.match(
    /\n\n<!-- shadowclone: ([^\n]+) -->\s*$/,
  );
  const metadata = metadataMatch?.[1];
  if (!metadata || metadataMatch.index === undefined) {
    return { key: null, content: block.trim(), edited: true };
  }

  const key = readMetadataValue({ metadata, name: "key" });
  const fingerprint = readMetadataValue({
    metadata,
    name: "fingerprint",
  });
  if (key === null || fingerprint === null) {
    return { key: null, content: block.trim(), edited: true };
  }

  const visible = block.slice(0, metadataMatch.index).trim();
  const [heading] = visible.split("\n");
  return {
    key,
    title: heading?.replace(/^#+\s*/, "").trim() ?? "",
    fingerprint,
    content: block.trim(),
    edited: profileFingerprint(visible) !== fingerprint,
  };
}

export function parseProfileBlocks(
  text: string,
): readonly ExistingProfileBlock[] {
  return text
    .trim()
    .split(/\n(?=## )/)
    .filter((block) => block.trim().length > 0)
    .map(parseBlock);
}

export function parseProfileRules(text: string): readonly ExistingProfileRule[] {
  return parseProfileBlocks(text).filter((block) => block.key !== null);
}
