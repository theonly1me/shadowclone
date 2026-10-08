# Pull request review evaluation

This evaluation compares three pull request reviewers on pull requests copied from one public repository: Shadowclone through its GitHub clone, openqodex on a local machine, and Greptile through its GitHub App. The headline is precision: how many findings are real, and how many are wrong. Detection of known bugs is secondary.

## Cases

1. `mine/index.ts` lists merged pull requests in a window. For each fix pull request, it runs `git blame` on the lines that the fix removed or changed, and on the line next to each pure insertion. The pull request that last touched those lines is a candidate that introduced a defect.
2. `validate.ts` gives both diffs to two judges, Claude Opus 5.5 and GPT 6.1 Sol. A candidate stays only when both judges say that the fix repairs a defect that the earlier pull request introduced.
3. `sample.ts` takes every validated defect case and a seeded random sample of clean pull requests: merged pull requests that no later fix blames.
4. `copy` pushes each case as a `case-<id>/base` branch and a `case-<id>/head` branch without the source workflows, and opens a draft pull request with a sanitized description.

## Arms

- **Shadowclone**: `@shadowclone review` on the pull request. The clone runs the released CLI with `claude-opus-5-5` at Claude Code's default effort.
- **openqodex**: `npx openqodex review '#<number>'` with `ANTHROPIC_MODEL=claude-opus-5-5`, the Claude reviewer, and its web tools on. It runs at Claude Code's default effort.
- **Greptile**: `@greptileai` on the pull request. Greptile uses its own models.

Each arm counts the findings that its users see: Shadowclone's posted findings, openqodex's `findings` and `outside_change`, and Greptile's inline review comments.

## Grading

Findings from all arms are pooled per case, shuffled, given random ids, and stripped of tool names and links. Both judges read the code at the head of the case and label each finding `real`, `minor`, or `wrong`. On a defect case, they also list the findings that identify the known defect. A label counts when both judges agree. The owner decides each disagreement without seeing which reviewer wrote the finding.

## Run it

```bash
bun evals/pr-review/mine/index.ts --repo vitejs/vite --clone <clone> --since 2026-03-01 --until 2026-10-08 --introduced-before 2026-09-08 --fix-within-days 60 --output <dir>
bun evals/pr-review/cli.ts validate --mined <dir> --clone <clone>
bun evals/pr-review/cli.ts sample --mined <dir> --clean 27 --seed 20261009
bun evals/pr-review/cli.ts copy --mined <dir> --clone <clone> --eval-repo <owner/name>
bun evals/pr-review/cli.ts run --arm <arm> --mined <dir> --runs <runs> --eval-repo <owner/name> --checkout <eval-clone> --model claude-opus-5-5
bun evals/pr-review/cli.ts judge --mined <dir> --runs <runs> --checkout <eval-clone> --clone <clone> --seed 20261009
```
