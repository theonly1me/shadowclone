import os from "node:os";
import type { TextRef } from "../observe";
import { redactionRules } from "./rules";

export function redactSecrets(options: {
  readonly text: string;
  readonly homeDirectory?: string;
}): string {
  const homeDirectory = options.homeDirectory ?? os.homedir();

  let redacted = homeDirectory
    ? options.text.replaceAll(homeDirectory, "~")
    : options.text;
  for (const rule of redactionRules) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }

  return redacted;
}

export const redactionLabels: readonly string[] = redactionRules.map(
  (rule) => rule.label,
);

export async function resolveRedacted(options: {
  readonly ref: TextRef;
}): Promise<string> {
  const file = Bun.file(options.ref.sourcePath);
  if (!(await file.exists()) || file.size < options.ref.byteOffset + options.ref.byteLength) {
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
