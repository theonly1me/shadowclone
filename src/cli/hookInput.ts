export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseHookInput(
  input: string,
): Readonly<Record<string, unknown>> {
  const value: unknown = JSON.parse(input);
  if (!isRecord(value)) {
    throw new Error("Hook input must be a JSON object");
  }
  return value;
}

export function readHookString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}
