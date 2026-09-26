import { readBoundedFile } from "../../io/files";
import { parseClaudeMemoryManifest } from "../../migrate/claudeMemory/manifest";
import { scanClaudeMemoryDirectory } from "../../migrate/claudeMemory/scan";
import type { ContextFile } from "../transfer/types";

export async function captureVerifiedMemory(options: {
  readonly directory: string;
  readonly manifestPath: string;
}): Promise<readonly ContextFile[]> {
  const text = await readBoundedFile({ filePath: options.manifestPath, roots: [options.manifestPath], maximumBytes: 262144 });
  if (text === null) throw new Error("Memory migration manifest is unavailable");
  const manifest = parseClaudeMemoryManifest(text);
  const files = await scanClaudeMemoryDirectory(options.directory);
  if (files.length === 0 || files.length !== manifest.files.length || manifest.files.some((expected) =>
    !files.some((file) => file.filename === expected.filename && file.hash === expected.hash)
  )) throw new Error("Memory snapshot does not match the migration manifest");
  return files.map((file) => ({
    relativePath: `memory/${file.filename}`,
    content: file.kind === "index" ? file.body : [`# ${file.name || file.filename}`, file.description, file.body].filter(Boolean).join("\n\n"),
  }));
}
