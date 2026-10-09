# Pull request review evaluation

This evaluation compares pull request reviewers on merged pull requests from one public repository. The headline is precision: how many findings are real, and how many are wrong. Detection of known bugs is secondary.

The local evaluation runs Shadowclone and openqodex on one machine. It creates nothing on GitHub. It has two modes:

- **Branch**: each case is a local repository with no remote. `main` is the base. One commit on `case` holds the head tree, with the upstream title and description as its message. Both reviewers review the branch with `--base main`.
- **Upstream**: both reviewers review the real pull request number in a clone of the source repository. They read the pull request through `gh` and post nothing. The reviewer knows the exact pull request, so it can fetch its page.

The cloud evaluation copies the cases into an evaluation repository and adds Greptile.

## Cases

1. `mine/index.ts` lists merged pull requests in a window. For each fix pull request, it runs `git blame` on the lines that the fix removed or changed. It also blames the line next to each pure insertion. The pull request that last touched those lines is a candidate that introduced a defect.
2. `validate.ts` gives both diffs to two judges, Claude Opus 5.5 and GPT 6.1 Sol. A candidate stays only when both judges say that the fix repairs a defect that the earlier pull request introduced.
3. `sample.ts` takes every validated defect case. It also takes a seeded random sample of clean pull requests: merged pull requests that no later fix blames.
4. `prepare` builds the local case repositories and writes `prepared.json`. For the cloud evaluation, `copy` pushes each case as a `case-<id>/base` branch and a `case-<id>/head` branch, without the source workflows. It then opens a draft pull request with a sanitized description.

## Arms

- **shadowclone-branch** and **shadowclone-upstream**: the same code as `shadowclone review --base main` and `shadowclone review <number>`. They use `claude-opus-5-5` at the default effort of Claude Code, with the toolchain checks on.
- **openqodex-branch** and **openqodex-upstream**: `npx openqodex review --base main` and `npx openqodex review '#<number>'`. They use the same settings as the cloud arm below.

The cloud arms:

- **Shadowclone**: `@shadowclone review` on the pull request. The clone runs the released CLI with `claude-opus-5-5` at the default effort of Claude Code.
- **openqodex**: `npx openqodex review '#<number>'` with `ANTHROPIC_MODEL=claude-opus-5-5`, the Claude reviewer, and its web tools on. It runs at the default effort of Claude Code.
- **Greptile**: `@greptileai` on the pull request. Greptile uses its own models.

Each arm counts the findings that its users see. For Shadowclone, these are the posted or written findings. For openqodex, these are `findings` and `outside_change`. For Greptile, these are the inline review comments.

## Grading

The grading pools the findings of all arms for each case. It shuffles them, gives them random ids, and removes tool names and links. Both judges read the code at the head of the case. They label each finding `real`, `minor`, or `wrong`. On a defect case, they also list the findings that identify the known defect. A label counts when both judges agree. The owner decides each disagreement without seeing which reviewer wrote the finding.

## Run it

```bash
bun evals/pr-review/mine/index.ts --repo vitejs/vite --clone <clone> --since 2026-03-01 --until 2026-10-08 --introduced-before 2026-09-08 --fix-within-days 60 --output <dir>
bun evals/pr-review/cli.ts validate --mined <dir> --clone <clone>
bun evals/pr-review/cli.ts sample --mined <dir> --clean 27 --seed 20261009
bun evals/pr-review/cli.ts prepare --mined <dir> --clone <clone> --cases-dir <cases>
bun evals/pr-review/cli.ts run --arm shadowclone-branch --mined <dir> --runs <runs> --clone <clone> --model claude-opus-5-5
bun evals/pr-review/cli.ts judge --cases prepared.json --mined <dir> --runs <runs> --clone <clone> --seed 20261009
```

The cloud evaluation replaces `prepare` and the local runs with these commands. Judge with `--cases copied.json`:

```bash
bun evals/pr-review/cli.ts copy --mined <dir> --clone <clone> --eval-repo <owner/name>
bun evals/pr-review/cli.ts run --arm <arm> --mined <dir> --runs <runs> --eval-repo <owner/name> --checkout <eval-clone> --model claude-opus-5-5
```
