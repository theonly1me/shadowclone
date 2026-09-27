import { lstat } from "node:fs/promises";
import { z } from "zod";
import { assertRegularDestination } from "../localFiles";
import { materializeSnapshot } from "../redact";
import type { ContextFile } from "../eval/transfer/types";

export const baselineSchema = z.object({
  version: z.literal(1),
  files: z.array(
    z.object({
      source: z.string(),
      relativePath: z.string(),
      hash: z.string(),
      scope: z.string().optional(),
      cwd: z.string().nullable().optional(),
    }),
  ),
  skills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      scope: z.string(),
      cwd: z.string().nullable(),
    }),
  ),
});

export async function capturedFile(options: {
  readonly filePath: string;
  readonly relativePath: string;
}): Promise<ContextFile> {
  assertRegularDestination(options.filePath);

  const file = Bun.file(options.filePath);

  if (file.size > 8_000_000) {
    throw new Error("Evaluation skill resource exceeds its snapshot limit");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = false;

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    binary = true;
  }

  const mode = (await lstat(options.filePath)).mode & 0o777;

  if (binary) {
    return {
      relativePath: options.relativePath,
      content: Buffer.from(bytes).toString("base64"),
      encoding: "base64",
      mode,
    };
  }

  const snapshot = await materializeSnapshot({
    filePath: options.filePath,
    roots: [options.filePath],
    maximumBytes: 2_000_000,
    parse: () => null,
  });

  if (snapshot === null) {
    throw new Error("Evaluation skill resource changed during capture");
  }

  return {
    relativePath: options.relativePath,
    content: snapshot.redacted,
    mode,
  };
}
