export function diffRows(diff) {
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  return diff.split("\n").flatMap((text) => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      return [{ kind: "header", oldLine: null, newLine: null, text }];
    }
    if (!inHunk || !/^[ +\-]/.test(text))
      return [{ kind: "header", oldLine: null, newLine: null, text }];
    const kind = text[0] === "+" ? "add" : text[0] === "-" ? "remove" : "context";
    const row = {
      kind,
      oldLine: kind === "add" ? null : oldLine,
      newLine: kind === "remove" ? null : newLine,
      text: text.slice(1),
    };
    if (kind !== "add") oldLine += 1;
    if (kind !== "remove") newLine += 1;
    return [row];
  });
}
