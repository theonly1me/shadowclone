import path from "node:path";
import { maximumProfileBytes } from "../io/limits";
import { materializeSnapshot } from "../redact";
import { stripManagedGuidance } from "./markdown";

const nativeGuidanceFiles = ["CLAUDE.md", "AGENTS.md"] as const;

export async function readNativeGuidance(cwd: string): Promise<readonly string[]> {
  const texts: string[] = [];
  for (const filename of nativeGuidanceFiles) {
    const snapshot = await materializeSnapshot({
      filePath: path.join(cwd, filename),
      roots: [cwd],
      maximumBytes: maximumProfileBytes,
      parse: () => null,
    }).catch(() => null);
    const text = snapshot === null ? "" : stripManagedGuidance(snapshot.redacted);
    if (text.trim().length > 0) texts.push(text);
  }
  return texts;
}
