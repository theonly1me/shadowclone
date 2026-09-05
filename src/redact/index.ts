import os from "node:os";
import { redactionRules } from "./rules";

export function redactSecrets(options: {
  readonly text: string;
  readonly homeDirectory?: string;
}): string {
  const homeDirectory = options.homeDirectory ?? os.homedir();

  let redacted = options.text;
  for (const rule of redactionRules) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }

  return homeDirectory ? redacted.replaceAll(homeDirectory, "~") : redacted;
}

export const redactionLabels: readonly string[] = redactionRules.map(
  (rule) => rule.label,
);
