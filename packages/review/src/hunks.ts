import type { DiffFile } from "./collect";

export type ReviewHunk = {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly added: readonly string[];
};

function fileSpans(file: DiffFile): readonly Omit<ReviewHunk, "id">[] {
  if (file.ranges.length === 0) {
    return file.changedLines > 0 ? [{ path: file.path, label: `${file.path} (removed lines)`, added: [] }] : [];
  }

  return file.ranges.map(([start, end]) => ({
    path: file.path,
    label: `${file.path}:${start}-${end}`,
    added: file.added.filter((line) => line.line >= start && line.line <= end).map((line) => line.text),
  }));
}

export function reviewHunks(files: readonly DiffFile[]): readonly ReviewHunk[] {
  return files.flatMap(fileSpans).map((span, index) => ({ id: `H${index + 1}`, ...span }));
}
