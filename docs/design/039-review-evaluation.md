# Review evaluation

## Problem

The first review evaluation (`evals/pr-review`) ran on 40 merged vite pull requests.

That harness cannot support a public claim:

- It has one kind of case: a merged pull request with at most one known defect.
- It has no case with many planted defects in a large change.
- It does not keep the cases that find Shadowclone bugs apart from the cases that score it.
- It runs each review once, so it shows no spread between runs.

## Decision

The [code-review-bench](https://github.com/theonly1me/code-review-bench) repository replaces `evals/pr-review`. It has one case format, two suites, a set of arms, and two graders. It is separate from Shadowclone and runs each reviewer through its public CLI or bot, so anyone can clone it and run it.

**Case.** A case is a local repository with `main` at the base and `case` at the head. The case also lists its known defects. Each defect has a summary, a fix, and its locations when they are known. A case with no known defect is a clean case. Each case belongs to the `dev` split or the `scored` split. The case repository has a neutral path, so no reviewer sees the case name.

**Suites.**

1. `real`: merged vite pull requests. Blame mining finds a pull request that a later fix repaired, and two judges confirm the defect. The `dev` split comes from merges before 2026-03-01. The `scored` split is the set from the first evaluation (2026-03-01 to 2026-10-08).
2. `planted`: a large pull request with planted defects. Its manifest stays private until the results are public. The owner publishes its sha256 before any review runs.

**Arms.** Each review runs in a fresh, shared clone of the case repository, and the harness removes the clone after the review.

- `shadowclone`: `shadowclone review --base main --output review.json` from a frozen checkout, with checks and network on.
- `shadowclone-cloud`: the bot comment on a copy of the case, pushed to an evaluation repository as a pull request. The copy leaves out `.github/workflows`, and the harness skips a case whose change edits a workflow.
- Other reviewers run through their public CLI or their pull request bot in the same way. The code-review-bench README lists them.

**Graders.** Blind judges: Claude Opus 5.5 and GPT 6.1 Sol read the head code. Each judge labels every pooled, anonymous finding `real`, `minor`, or `wrong`, and names the findings that identify each known defect. A label counts when both judges agree. The owner decides each disagreement blind.

**Approval.** A command that calls a model prints its plan: the host, the model, and the number of calls. It runs only with `--yes` and a `--max-calls` ceiling that covers the plan.

**Order.**

1. Build the harness and pilot one case for each suite and arm.
2. Fix Shadowclone bugs with the `dev` split only.
3. Freeze the versions of each reviewer, Claude Code, and the model.
4. Run every `scored` case once for each repeat, with 3 repeats for the local arms.
5. Grade, then publish the results with the raw outputs.

## Consequences

- The cloud arms review only cases that do not change a workflow.
- Shadowclone shows the results in [`evals.md`](../../evals.md) and links to the harness.
- The first harness and its results stay in the history of this record and of [036](036-pull-request-review.md).

## Verification

- Unit tests cover the case schema, the detection rule for two judges, and the plan check for `--max-calls`.
- A pilot runs one case for each suite and arm, and the report lists its time and cost.
