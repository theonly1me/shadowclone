import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runProcess } from "../../../src/io/process";
import { type CopiedCase, copiedCaseSchema } from "../copy";
import { inBatches } from "../github";
import { askJudges } from "../judges";
import type { NormalizedFinding } from "../normalize";
import { type BlindFinding, judgePrompt, judgmentSchema } from "./prompt";

const blindIdLength = 6;

async function git(options: { readonly checkout: string; readonly arguments: readonly string[] }): Promise<string> {
  const result = await runProcess({ arguments: ["git", ...options.arguments], cwd: options.checkout, environment: process.env, timeoutMilliseconds: 300_000 });

  return result.stdout;
}

function blindId(seed: string): string {
  return `F${new Bun.CryptoHasher("sha256").update(seed).digest("hex").slice(0, blindIdLength)}`;
}

export async function judgeCase(options: {
  readonly entry: CopiedCase;
  readonly findings: readonly NormalizedFinding[];
  readonly checkout: string;
  readonly mined: string;
  readonly fixDiff: string | null;
  readonly seed: string;
}): Promise<unknown> {
  const { entry } = options;
  const blind = options.findings.map((finding, index) => ({ finding, id: blindId(`${options.seed}:${entry.id}:${index}`) })).sort((left, right) => left.id.localeCompare(right.id));
  const head = path.join(options.mined, "judge-worktrees", entry.id);

  await git({ checkout: options.checkout, arguments: ["fetch", "--quiet", "origin", `case-${entry.id}/head`, `case-${entry.id}/base`] });
  rmSync(head, { recursive: true, force: true });
  mkdirSync(path.dirname(head), { recursive: true });
  await git({ checkout: options.checkout, arguments: ["worktree", "add", "--detach", "--force", head, entry.headSha] });

  try {
    const answers = await askJudges({
      prompt: judgePrompt({
        title: entry.title,
        diff: (await git({ checkout: options.checkout, arguments: ["diff", "--no-color", `${entry.baseSha}...${entry.headSha}`] })).slice(0, 120_000),
        findings: blind.map(({ finding, id }): BlindFinding => ({ id, path: finding.path, line: finding.line, text: finding.text })),
        defect: entry.kind === "defect" && entry.defect !== null ? { description: entry.defect, fixDiff: (options.fixDiff ?? "").slice(0, 40_000) } : null,
      }),
      schema: judgmentSchema,
      cwd: head,
    });

    return { caseId: entry.id, kind: entry.kind, findings: blind.map(({ finding, id }) => ({ ...finding, id })), answers };
  } finally {
    await git({ checkout: options.checkout, arguments: ["worktree", "remove", "--force", head] });
  }
}

export async function judgeAll(options: {
  readonly mined: string;
  readonly checkout: string;
  readonly clone: string;
  readonly findingsByCase: ReadonlyMap<string, readonly NormalizedFinding[]>;
  readonly output: string;
  readonly seed: string;
  readonly fixCommits: ReadonlyMap<number, string>;
}): Promise<void> {
  const copied = z.array(copiedCaseSchema).parse(JSON.parse(readFileSync(path.join(options.mined, "copied.json"), "utf8")));
  const results = await inBatches({
    items: copied,
    size: 4,
    work: async (entry) => {
      const fixCommit = entry.fix === null ? undefined : options.fixCommits.get(entry.fix);
      const fixDiff = fixCommit === undefined ? null : await git({ checkout: options.clone, arguments: ["diff", "--no-color", `${fixCommit}^`, fixCommit] });
      const result = await judgeCase({ entry, findings: options.findingsByCase.get(entry.id) ?? [], checkout: options.checkout, mined: options.mined, fixDiff, seed: options.seed });

      console.error(`judged ${entry.id}`);
      return result;
    },
  });

  writeFileSync(options.output, JSON.stringify(results, null, 2));
}
