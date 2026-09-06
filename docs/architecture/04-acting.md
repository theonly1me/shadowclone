# Acting

This document sets the ceiling on what a clone may do, in a session and unattended.

## Tiers

`.claude/skills/data-handling/SKILL.md` defines three tiers and this design keeps them.

**Observe and derive** runs unattended with no ceremony. Reading transcripts, mining signals, writing the profile. Nothing leaves the machine except through the engine, under the user's own account.

**Draft** runs unattended. Producing a diff or a message left in a file. Nothing another person can see.

**Act** changes state outside the run. Committing, pushing, opening a PR, replying to a review, commenting on an issue. This tier requires explicit approval for the action, bounded by a per-repo ceiling.

## Two ways a clone runs

**As a subagent, inside the user's own session.** The profile compiles to `.claude/agents/<name>.md`, and the main session dispatches copies of the user onto subtasks with the `Agent` tool, several at once. The user is present, the session's permission mode applies, and every action is visible in the transcript being written. This is the primary way clones spawn, because it composes with the tool already open and needs no worktree, no policy resolution, and no receipt. It is also where the multiplier lives, since one person does one thing at a time and ten subagents do ten.

**Headless, in a worktree.** `shadowclone run` for work that happens while the user is away. This is the path the rest of this document governs, because nobody is watching it.

## The policy

Full delegation is the goal and an empty allowlist is the default. Invoking `shadowclone run "<task>"` explicitly approves one worktree, branch, and local commit for that task. A fresh install can do that and nothing else, on any repo, with no configuration.

```toml
[repo."github.com/atchyut/shadowclone"]
allow = ["push", "pr-draft", "pr-reply"]
maxBudgetUsd = 2.00
requireCleanExit = true

[repo."github.com/employer/platform"]
allow = []
```

Promotion is a deliberate edit to a config file, one repo at a time. The entry is a ceiling, not standing approval. A remote action also needs a matching `--approve` on the individual run. There is no global switch that turns delegation on everywhere, because the repo where this is a good idea and the repo where it ends a job are usually on the same laptop.

`src/dispatch/policy.ts` intersects repo policy, per-run approval, and the managed action tier to produce engine arguments. Unattended execution sets `permissionMode: "dontAsk"`, ensuring `allowedTools` acts as an enforced ceiling. A withheld capability becomes a `--disallowedTools` entry. Absence of a tool beats a rule about a tool. The engine never receives wildcard add, commit, or push tools.

Draft tools include inspection, edits, and repository verification commands detected dynamically from project manifests (`package.json`, `Cargo.toml`, `go.mod`, `Makefile`, `pyproject.toml`) or configured per repository with `:*` argument suffixes.

Push safety is handled outside the agent process. Rather than exposing `Bash(git push:*)` to agent execution, the host orchestrator inspects the resulting worktree and performs an explicit `git push --set-upstream origin <branch>` after the run. Commits are likewise created host-side with fixed argument vectors.

## A run

1. Resolve the policy for the target repo. No entry means draft tier.
2. `git worktree add ~/.shadowclone/worktrees/<runId> -b shadowclone/<slug>`. The user's working tree is never the working directory of a clone.
3. Compile the profile for this repo into `.compiled.md`.
4. Generate a run UUID and pass it as `--session-id`, so the clone's transcript is findable.
5. Run the engine with the policy's tools, `dontAsk` permission mode, and budget.
6. Commit a successful change with fixed `git add --all` and `git commit` argument vectors.
7. If push was approved, execute host-side upstream push.
8. Inspect the worktree and write `~/.shadowclone/runs/<runId>/receipt.json`.
9. Leave the worktree in place for review.

## The receipt

Every run produces one, and it is the artifact that makes delegation reviewable rather than mysterious.

```json
{
  "runId": "...",
  "task": "...",
  "repo": "...",
  "branch": "shadowclone/fix-flaky-collector-test",
  "engine": "claude-code",
  "model": "...",
  "sessionId": "...",
  "transcriptPath": "~/.claude/projects/.../<sessionId>.jsonl",
  "startedAt": "...",
  "durationMs": 0,
  "costUsd": 0,
  "turns": 0,
  "filesChanged": [],
  "commits": [],
  "actionsTaken": ["commit"],
  "actionsBlockedByPolicy": ["push"],
  "permissionDenials": [],
  "profileRulesApplied": 34
}
```

`actionsBlockedByPolicy` is there so the user can see what the clone wanted to do and could not. That list is the best available evidence for whether a repo is ready to be promoted, and it is also a correction signal in its own right.

## Learning from its own runs

The clone's transcript is written to the same place the user's transcripts are written, in the same format, and the run receipt records exactly where. The observe stage reads it with no special case.

What closes the loop is the user's response to the work. A branch that gets merged is a positive example. A branch that gets deleted unreviewed is a negative one. A branch the user rewrites before merging is the most valuable record in the system, because the diff between what the clone wrote and what shipped is a correction pair with no ambiguity in it.

That last one is the strongest signal shadowclone can produce and it is deliberately not in the first release. It needs the profile to be good enough that clone runs are worth reviewing at all, and until then it would be learning from noise.

## What is never allowed

No tier and no allowlist entry grants any of these.

`--dangerously-skip-permissions` and `--permission-mode bypassPermissions` are never passed. `git push --force` in any form. Any write to a branch a human is working on. Any action on a repo with no policy entry. Any spend above the run's `maxBudgetUsd`. Merging a pull request, at any tier, ever.
