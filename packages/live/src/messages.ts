import { redactSecrets } from "@shadowclone/redact";

export const summaryLimit = 2048;

export function boundedText(options: { readonly text: string; readonly limit: number }): string {
  const redacted = redactSecrets({ text: options.text.trim() });

  return redacted.length <= options.limit ? redacted : `${redacted.slice(0, options.limit - 1)}…`;
}

export function liveOwnerMessage(texts: readonly string[]): string {
  return [
    "A message from the owner arrived through shadowclone. Follow it, then continue.",
    ...texts.flatMap((text) => ["<owner-message>", text, "</owner-message>"]),
  ].join("\n");
}
