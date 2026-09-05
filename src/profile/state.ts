export type ProfileStateEntry = {
  readonly relativePath: string;
  readonly key: string;
};

export async function readProfileState(
  statePath: string,
): Promise<readonly ProfileStateEntry[]> {
  const file = Bun.file(statePath);
  if (!(await file.exists())) {
    return [];
  }
  return (await file.text())
    .split("\n")
    .flatMap((line) => {
      const [relativePath, key] = line.split("\t");
      return relativePath && key ? [{ relativePath, key }] : [];
    });
}

export function renderProfileState(
  entries: readonly ProfileStateEntry[],
): string {
  return `${entries
    .slice()
    .sort(
      (left, right) =>
        left.relativePath.localeCompare(right.relativePath) ||
        left.key.localeCompare(right.key),
    )
    .map((entry) => `${entry.relativePath}\t${entry.key}`)
    .join("\n")}\n`;
}
