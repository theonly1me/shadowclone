export type SessionCommand =
  { readonly kind: "work"; readonly task: string } | { readonly kind: "review" };

const commandPattern = /^\s*\/shadowclone(?=$|\s)/i;

export function parseSessionCommand(body: string): SessionCommand | null {
  const [firstLine = "", ...rest] = body.split(/\r?\n/);

  if (!commandPattern.test(firstLine)) {
    return null;
  }

  const firstLineTask = firstLine.replace(commandPattern, "").trim();

  if (/^review$/i.test(firstLineTask)) {
    return { kind: "review" };
  }

  return { kind: "work", task: [firstLineTask, ...rest].join("\n").trim() };
}
