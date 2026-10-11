import { runHostCommand } from "@shadowclone/core";
import type { PreparedComment, PreparedReview, GuidedNote } from "./schema";

export type AnchorFile = {
  readonly path: string;
  readonly oldPath: string;
  readonly diff: string;
  readonly base: string | null;
  readonly head: string | null;
};

function diffSides(diff: string) {
  const left = new Set<number>();
  const right = new Set<number>();
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  for (const text of diff.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (text.startsWith("-")) {
      left.add(oldLine);
      oldLine += 1;
    } else if (text.startsWith("+")) {
      right.add(newLine);
      newLine += 1;
    } else if (text.startsWith(" ")) {
      left.add(oldLine);
      right.add(newLine);
      oldLine += 1;
      newLine += 1;
    }
  }
  return { LEFT: left, RIGHT: right };
}

export function validatePreparedReview(options: {
  readonly prepared: PreparedReview;
  readonly notes: readonly GuidedNote[];
  readonly files: readonly AnchorFile[];
}): void {
  const covered = new Set<string>();
  const validIds = new Set(options.notes.map((note) => note.id));
  for (const comment of options.prepared.comments) {
    const file = options.files.find((entry) => entry.path === comment.path);
    if (!file) throw new Error("A prepared comment targets a file outside the current PR diff.");
    const side = diffSides(file.diff)[comment.side];
    for (let line = comment.startLine; line <= comment.line; line += 1) {
      if (!side.has(line))
        throw new Error("A prepared comment targets a line outside the current diff.");
    }
    const source = comment.side === "RIGHT" ? file.head : file.base;
    if (
      source === null ||
      source
        .split("\n")
        .slice(comment.startLine - 1, comment.line)
        .join("\n") !== comment.quote
    )
      throw new Error("A prepared comment quote does not match current source.");
    for (const id of comment.noteIds) {
      if (!validIds.has(id) || covered.has(id))
        throw new Error("Prepared comments duplicate or add an unselected note.");
      covered.add(id);
    }
  }
  for (const held of options.prepared.held) {
    if (!validIds.has(held.id) || covered.has(held.id))
      throw new Error("Held notes duplicate or add an unselected note.");
    covered.add(held.id);
  }
  if (covered.size !== validIds.size)
    throw new Error("The agent omitted a selected note. Nothing was staged.");
}

async function readGit(options: {
  readonly checkout: string;
  readonly arguments: readonly string[];
}): Promise<string> {
  const result = await runHostCommand({
    arguments: ["git", "--no-replace-objects", "--literal-pathspecs", ...options.arguments],
    cwd: options.checkout,
  });
  if (result.exitCode !== 0)
    throw new Error(
      "Current PR objects are unavailable. Fetch its current head and base before staging.",
    );
  return result.stdout;
}

export async function currentAnchorFiles(options: {
  readonly checkout: string;
  readonly headSha: string;
  readonly baseSha: string;
}): Promise<readonly AnchorFile[]> {
  const mergeBase = (
    await readGit({
      checkout: options.checkout,
      arguments: ["merge-base", options.baseSha, options.headSha],
    })
  ).trim();
  const names = (
    await readGit({
      checkout: options.checkout,
      arguments: ["diff", "--name-status", "-z", "--find-renames", mergeBase, options.headSha],
    })
  ).split("\0");
  const files: AnchorFile[] = [];
  while (names.length) {
    const status = names.shift();
    if (!status) break;
    const original = names.shift();
    const renamed = /^[RC]/.test(status);
    const current = renamed ? names.shift() : original;
    if (!original || !current) throw new Error("The current diff file inventory is incomplete.");
    const diff = await readGit({
      checkout: options.checkout,
      arguments: [
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "--unified=5",
        mergeBase,
        options.headSha,
        "--",
        original,
        current,
      ],
    });
    const base = status.startsWith("A")
      ? null
      : await readGit({
          checkout: options.checkout,
          arguments: ["show", mergeBase + ":" + original],
        });
    const head = status.startsWith("D")
      ? null
      : await readGit({
          checkout: options.checkout,
          arguments: ["show", options.headSha + ":" + current],
        });
    files.push({ path: current, oldPath: original, diff, base, head });
  }
  return files;
}

export function pendingInlineComment(comment: PreparedComment) {
  return {
    path: comment.path,
    line: comment.line,
    side: comment.side,
    body: comment.body,
    ...(comment.startLine !== comment.line
      ? { start_line: comment.startLine, start_side: comment.side }
      : {}),
  };
}
