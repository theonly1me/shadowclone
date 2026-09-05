# Acting

This document sets the ceiling on what a clone may do, in a session and unattended.

## Tiers

`.claude/skills/data-handling/SKILL.md` defines three tiers and this design keeps them.

**Observe and derive** runs unattended with no ceremony. Reading transcripts, mining signals, writing the profile. Nothing leaves the machine except through the engine, under the user's own account.

**Draft** runs unattended. Producing a diff, a commit on a throwaway branch, a message left in a file. Nothing another person can see.

**Act** changes state someone else can observe. Pushing, opening a PR, replying to a review, commenting on an issue. This tier is gated, and the gate is per repo rather than per session.

## Two ways a clone runs

**As a subagent, inside the user's own session.** The profile compiles to `.claude/agents/<name>.md`, and the main session dispatches copies of the user onto subtasks with the `Agent` tool, several at once. The user is present, the session's permission mode applies, and every action is visible in the transcript being written. This is the primary way clones spawn, because it composes with the tool already open and needs no worktree, no policy resolution, and no receipt. It is also where the multiplier lives, since one person does one thing at a time and ten subagents do ten.

**Headless, in a worktree.** `shadowclone run` for work that happens while the user is away. This is the path the rest of this document governs, because nobody is watching it.

## The policy

Full delegation is the goal and an empty allowlist is the default. A fresh install can produce a branch and a commit in a worktree and nothing else, on any repo, with no configuration.

```toml
[repo."github.com/atchyut/shadowclone"]
allow = ["push", "pr-draft", "pr-reply"]
maxBudgetUsd = 2.00
requireCleanExit = true

[repo."github.com/employer/platform"]
allow = []
```

Promotion is a deliberate edit to a config file, one repo at a time. There is no global switch that turns delegation on everywhere, because the repo where this is a good idea and the repo where it ends a job are usually on the same laptop.

`src/dispatch/policy.ts` turns a policy into engine arguments. A repo without `push` in its allowlist does not get a permission prompt about pushing, it gets a `--disallowedTools` entry that removes the capability. Absence of a tool beats a rule about a tool.

## A run

1. Resolve the policy for the target repo. No entry means draft tier.
2. `git worktree add ~/.shadowclone/worktrees/<runId> -b shadowclone/<slug>`. The user's working tree is never the working directory of a clone.
3. Compile the profile for this repo into `.compiled.md`.
4. Generate a run UUID and pass it as `--session-id`, so the clone's transcript is findable.
5. Run the engine with the policy's tools, permission mode, and budget.
6. Write `~/.shadowclone/runs/<runId>/receipt.json`.
7. Leave the worktree in place for review. `shadowclone runs --clean` removes merged and abandoned ones.

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
