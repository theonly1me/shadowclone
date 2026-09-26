import type { Convention } from "./conventions";
import type { HarnessPlan } from "./plan";

const maximumAgentsLines = 150;

function describeConvention(convention: Convention): string {
  if (convention.kind === "file-length") return `files at most ${convention.maximumLines} lines`;
  if (convention.kind === "forbidden-text") return `no ${convention.name} characters`;
  if (convention.kind === "no-suppressions") return "no lint or type suppressions";
  return "no comments in TypeScript";
}

function omissionSummary(plan: HarnessPlan): string {
  const counts = new Map<string, number>();
  for (const omission of plan.compilation.omissions) counts.set(omission.reason, (counts.get(omission.reason) ?? 0) + 1);
  return [...counts].map(([reason, count]) => `${count} ${reason}`).join(", ") || "none";
}

export function renderHarnessPreview(options: { readonly plan: HarnessPlan; readonly revision?: string | null }): string {
  const { plan } = options;
  const gate = plan.gate === null
    ? "Gate: none detected. Add a check script or Makefile target, then run this again."
    : `Gate: \`${plan.gate.command}\` from ${plan.gate.source}${plan.gate.ciRunsGate ? ", also run by CI" : ", not found in CI workflows"}.`;
  const agents = plan.files.find((file) => file.relativePath === "AGENTS.md")?.next ?? "";
  const lines = [
    gate,
    `Rules: ${plan.compilation.appliedRuleCount} included, personal global preferences ${plan.personal ? "included" : "excluded"}; omitted: ${omissionSummary(plan)}.`,
    ...(plan.compilation.markdown.length === 0 ? [] : [plan.compilation.markdown.trimEnd()]),
    `Conventions recorded for checks: ${plan.conventions.map(describeConvention).join(", ") || "none"}.`,
    "Files:",
    ...plan.files.map((file) => `  ${file.status} ${file.relativePath}: ${file.reason}`),
    "Codex and Cursor read AGENTS.md and .agents/skills. Claude Code reads CLAUDE.md, which imports AGENTS.md, and .claude/skills.",
    "These files are meant to be committed. Anyone with access to the repository will see them, including the rules above.",
    ...(agents.split("\n").length > maximumAgentsLines ? [`Warning: AGENTS.md would exceed ${maximumAgentsLines} lines; shorten the text outside the managed section.`] : []),
  ];
  if (options.revision === undefined) lines.push("Nothing was written. Run `shadowclone harness init --apply` to write these files.");
  else if (options.revision === null) lines.push("The harness is already up to date.");
  else lines.push(`Wrote revision ${options.revision}. Review with \`git diff\`; restore with \`shadowclone undo ${options.revision}\`. Nothing was committed.`);
  return `${lines.join("\n")}\n`;
}
