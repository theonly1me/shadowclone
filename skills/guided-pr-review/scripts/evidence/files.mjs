import { gitRead, blobText } from "./git.mjs";

import { diffRows } from "../document/diff.mjs";

export function collectFiles(options) {
  const names = gitRead({
    checkout: options.checkout,
    arguments: [
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      options.mergeBaseSha,
      options.headSha,
    ],
  }).split("\0");
  const files = [];
  while (names.length > 0) {
    const status = names.shift();
    if (!status) break;
    const firstPath = names.shift();
    const renamed = /^[RC]/.test(status);
    const filePath = renamed ? names.shift() : firstPath;
    if (!firstPath || !filePath) throw new Error("Git returned an incomplete file inventory.");
    const oldPath = renamed ? firstPath : filePath;
    const diff = gitRead({
      checkout: options.checkout,
      arguments: [
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "--find-renames",
        "--unified=5",
        options.mergeBaseSha,
        options.headSha,
        "--",
        oldPath,
        filePath,
      ],
    });
    const base =
      status[0] === "A"
        ? null
        : blobText({ checkout: options.checkout, sha: options.mergeBaseSha, path: oldPath });
    const head =
      status[0] === "D"
        ? null
        : blobText({ checkout: options.checkout, sha: options.headSha, path: filePath });
    const rows = diffRows(diff);
    files.push({
      path: filePath,
      oldPath,
      status,
      binary: /^(?:Binary files|GIT binary patch)/m.test(diff),
      base,
      head,
      diff,
      rows,
      additions: rows.filter((row) => row.kind === "add").length,
      deletions: rows.filter((row) => row.kind === "remove").length,
    });
  }
  return files;
}
