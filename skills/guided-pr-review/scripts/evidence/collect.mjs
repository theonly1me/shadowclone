import { gitRead, blobText, isAncestor } from "./git.mjs";
import { collectFiles } from "./files.mjs";
import { validateReport } from "../document/validate.mjs";

export function collectReport(input) {
  validateReport(input);
  const pulls = input.pulls.map((pull) => {
    gitRead({ checkout: pull.checkout, arguments: ["cat-file", "-e", pull.baseSha + "^{commit}"] });
    gitRead({ checkout: pull.checkout, arguments: ["cat-file", "-e", pull.headSha + "^{commit}"] });
    const mergeBaseSha = gitRead({
      checkout: pull.checkout,
      arguments: ["merge-base", pull.baseSha, pull.headSha],
    }).trim();
    const { checkout, files: discardedFiles, ...metadata } = pull;
    return {
      ...metadata,
      mergeBaseSha,
      files: collectFiles({ checkout, mergeBaseSha, headSha: pull.headSha }),
    };
  });
  const evidence = input.evidence.map((item) => {
    const pull = input.pulls.find((entry) => entry.id === item.pr);
    const collected = pulls.find((entry) => entry.id === item.pr);
    const sha = item.side === "HEAD" ? pull.headSha : collected.mergeBaseSha;
    const source = blobText({ checkout: pull.checkout, sha, path: item.path });
    if (source === null) throw new Error("A binary file cannot supply text evidence: " + item.path);
    const lines = source.split("\n");
    if (item.end > lines.length) throw new Error("Evidence range is outside " + item.path);
    const text = lines.slice(item.start - 1, item.end).join("\n");
    if (text !== item.quote)
      throw new Error("Evidence " + item.id + " does not match " + item.path + " at " + sha);
    return { ...item, text, sha };
  });
  const stackEdges = [];
  for (const child of pulls)
    for (const parent of pulls) {
      if (parent.id === child.id || parent.repository !== child.repository) continue;
      const original = input.pulls.find((entry) => entry.id === child.id);
      if (isAncestor({ checkout: original.checkout, from: parent.headSha, to: child.mergeBaseSha }))
        stackEdges.push({ from: parent.id, to: child.id });
    }
  const combined = pulls.find((candidate) =>
    pulls.every((pull) => {
      if (pull.repository !== candidate.repository) return false;
      const original = input.pulls.find((entry) => entry.id === candidate.id);
      return isAncestor({ checkout: original.checkout, from: pull.headSha, to: candidate.headSha });
    }),
  );
  const report = { ...input, pulls, evidence, stackEdges, combinedHead: combined?.headSha ?? null };
  return validateReport(report);
}
