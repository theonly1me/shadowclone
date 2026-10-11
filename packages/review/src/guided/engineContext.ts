import type { GuidedNote, GuidedReport } from "./schema";
import type { AnchorFile } from "./anchors";

export function selectedCodeContext(options: {
  readonly notes: readonly GuidedNote[];
  readonly report: GuidedReport;
  readonly files: readonly AnchorFile[];
}) {
  const evidence = options.report.evidence.filter((item) =>
    options.notes.some((note) => note.evidence.includes(item.id)),
  );
  const groups = options.report.groups.filter((group) =>
    options.notes.some(
      (note) =>
        note.anchor.includes(group.id) ||
        group.evidence.some((id) => note.evidence.includes(id)) ||
        group.files.some((file) => file.path === note.source?.path && file.pr === note.pr),
    ),
  );
  const paths = new Set([
    ...options.notes.flatMap((note) => (note.source ? [note.source.path] : [])),
    ...evidence.map((item) => item.path),
    ...groups.flatMap((group) => group.files.map((file) => file.path)),
  ]);
  const excerpt = (input: { readonly source: string | null; readonly path: string }) => {
    if (input.source === null) return null;
    const lines = input.source.split("\n");
    const anchors = [
      ...options.notes.flatMap((note) =>
        note.source?.path === input.path ? [note.source.start] : [],
      ),
      ...evidence.filter((item) => item.path === input.path).map((item) => item.start),
    ];
    const startLine = Math.max(1, (anchors[0] ?? 1) - 20);
    const endLine = Math.min(lines.length, startLine + 119);
    const text = lines.slice(startLine - 1, endLine).join("\n");
    return {
      startLine,
      endLine,
      text: text.slice(0, 24_000),
      textTruncated: text.length > 24_000,
      totalLines: lines.length,
    };
  };
  const files = options.files
    .filter((file) => paths.has(file.path) || paths.has(file.oldPath))
    .map((file) => ({
      path: file.path,
      oldPath: file.oldPath,
      diff: file.diff.slice(0, 60_000),
      diffTruncated: file.diff.length > 60_000,
      base: excerpt({ source: file.base, path: file.oldPath }),
      head: excerpt({ source: file.head, path: file.path }),
    }));
  return { evidence, groups, files };
}
