# Measure shadowclone-work, then remove its harness

## Problem

`shadowclone-work` is a 10-step procedure over the `shadowclone_task` MCP tool. No evaluation exercises it, so nothing shows that its task records, receipts, and grants improve the result. Its finish line also stops before the work that takes the most time after a PR opens: failing checks, conflicts, and reviewer comments.

## Decision

Rewrite `shadowclone-work` as a skill that takes a request, an issue, or an existing PR to a PR that is ready for review:

1. Build the change with tests and verify it with the repository's own checks.
2. Open a draft PR, then loop until every code check passes on the current head, the branch does not conflict with its base, and every reviewer comment is handled. Rerun a flaky job once on the same commit. Report a check that waits for a human, and never push to retrigger it.
3. Fix a valid comment, push, and reply with only the full 40-character SHAs of the fixing commits. Resolve the thread only when a bot wrote it.
4. Decline a comment by leaving it unanswered and open, for humans and bots alike. Comments addressed to other tools or to "AI agents" are not tasks.
5. Outside a stack, merge the base branch in and never force push. In a stack, restack with `gh stack rebase` and push with `gh stack push`.
6. Mark the PR ready for review. Never merge, and never post words on the PR or add attribution.

Compare arms with `claude plugin eval` and `claude-sonnet-5-5`, each loaded as a plugin with `--ablation none`: no skill, the skill alone, and, for this decision, the skill plus task receipts. The receipts arm ran the real `shadowclone mcp` server for `start`, `verify`, review, and completion receipts. Its git and `gh` actions went through the same stand-ins as the other arms, because task grants bind to a real GitHub remote and the harness would otherwise call the real `gh` outside the sandbox.

Fifteen cases come from the owner's pull request history, rewritten as synthetic fixtures. They cover a feature from an issue, flaky and real CI failures, a human-approval check, bot noise next to real bugs, human scope requests, reviews that arrive after a push or after marking ready, a moved base, a stack restack conflict, a fix that belongs in a stack's parent, another bot's commit on the branch, approval while blockers remain, severity labels that mislead, and comments addressed to other tools. A seeded split holds out five cases for testing.

Each case scaffolds a small Python repository with a local bare remote and a compiled stand-in for `gh`, including `gh api` REST and GraphQL review threads, check runs and reruns, and `gh stack`. A plugin `SessionStart` hook puts the case's `bin/` first on `PATH`. The scaffold also copies the platform's git binary into that folder, because the evaluation sandbox denies the system git paths on macOS.

A grader reads each kept run after it finishes. It copies only the remote's objects and refs into a fresh repository, never runs git or agent code inside the kept directory, and checks:

- code checks on each target PR's final head, from the results the stand-in produced inside the sandbox
- ready, not merged, no conflict with the base, and stack ancestry
- each thread against the reply and resolution rules
- no words on the PR, no attribution in titles, bodies, or commits
- no history rewrite outside `gh stack`, and no lost commits from other authors
- changed files within the case's scope, no empty commits, no access to the stand-in's files
- the repository's title convention and template for new PRs

An Opus judge checks only the final chat report. The owner decides whether the receipts layer stays after reading the held-out results and transcripts.

## Results

All runs used `claude-sonnet-5-5`, with two runs per case for no skill and three for each skill arm. Pass means every grading rule held.

| Arm | Train | Test | All |
| --- | --- | --- | --- |
| No skill | 0% | 20% | 7% |
| Skill | 47% | 67% | 53% |
| Skill with task receipts | 50% | 53% | 51% |
| Skill after one hillclimb round | 97% | 100% | 98% |

Receipts did not change the outcome, so the task harness, its `task` command, its MCP tool, and the dispatch code only it used are removed. The skill ships without them.

One hillclimb round on the train cases found two gaps. Claude Code adds a `Co-Authored-By` trailer to commits unless told not to, which failed half of the train runs. The agent also replied once with a later test-only commit instead of the commit that changed the code. Two explicit rules fixed both. The one remaining failure came from the stand-in's check logs pointing into its private folder, which is fixed.

## Consequences

Evaluation material in `evals/shadowclone-work/` is synthetic and stays out of the npm package. Builds, run results, transcripts, and costs stay outside the checkout.

The stand-in cannot reproduce every GitHub behavior. Calls it does not support fail with a logged error and are counted per run, so they show up as harness gaps rather than skill failures.

A comparison of both arms is 75 runs. At about one minute and $0.19 per run, four at a time per arm, it finishes in about 10 minutes. Two or three runs per case resolve only large differences, about 15 points.

`claude plugin eval` refuses Bash-granting runs while `~/.docker` holds symbolic links, which Docker Desktop creates for its CLI plugins. Move them aside for the length of a run and restore them afterwards.

## Verification

Unit tests drive the stand-in against real git workspaces, check that every case starts in its designed state, and run reference solutions and plausible mistakes through the grader. Pilot runs confirmed git, checks, and replies work inside the sandbox before the full run.
