# Acting

This document sets the ceiling on what a clone may do, in a session and unattended.

## Tiers

`.claude/skills/data-handling/SKILL.md` defines three tiers and this design keeps them.

**Observe and derive** runs unattended with consent. It reads enabled transcripts, updates the local index, mines aggregate signals, and refreshes compiled local guidance. Default setup can write mined profile rules during its bounded first pass when background learning is enabled. Manual `learn --deep` also proposes rules for approval. Eligible excerpts leave the machine only through the user's authenticated agent CLI after redaction.

**Draft** runs unattended. Producing a diff or a message left in a file. Nothing another person can see.

**Act** changes state outside the run. Committing, pushing, opening a PR, replying to a review, commenting on an issue. This tier requires explicit approval for the action, bounded by a per-repo ceiling.

## Optional delegated execution

**As a subagent inside the user's own session.** Claude's `SubagentStart` hook injects the current compiled profile into spawned subagents. It does not create a second learning request. An optional repository `--subagent` installation also writes `.claude/agents/<name>.md` for explicit dispatch through the `Agent` tool. The session's permission mode applies, and its transcript can feed later learning. Main-agent delivery remains the default product path.

**Headless, in a worktree.** `shadowclone run` for work that happens while the user is away. This is the path the rest of this document governs, because nobody is watching it.

## The policy

Full delegation is the goal and an empty allowlist is the default. Invoking `shadowclone run "<task>"` explicitly approves one worktree, branch, and local commit for that task. A fresh install can do that and nothing else, on any repo, with no configuration.

```toml
[repo."github.com/example-personal/sample"]
allow = ["push", "pr-draft", "pr-reply"]
maxBudgetUsd = 2.00

[repo."github.com/example-team/service"]
allow = []
```

Repository policy keys use the full `host/owner/repository` identity and require the `git-metadata` source. When that source is disabled, `resolveRepository` produces an isolated identity, so a named repository entry cannot match.

Promotion is a deliberate edit to a config file, one repo at a time. The entry is a ceiling, not standing approval. A remote action also needs a matching `--approve` on the individual run. There is no global switch that grants remote actions everywhere.

`src/dispatch/policy.ts` intersects repo policy, per-run approval, and the managed action tier to produce engine arguments. Unattended execution sets `permissionMode: "dontAsk"`, ensuring `allowedTools` acts as an enforced ceiling. A withheld capability becomes a `--disallowedTools` entry. Absence of a tool beats a rule about a tool. The engine never receives wildcard add, commit, or push tools.

Draft tools include inspection, edits, and repository verification commands detected dynamically from project manifests (`package.json`, `Cargo.toml`, `go.mod`, `Makefile`, `pyproject.toml`) or configured per repository with `:*` argument suffixes. These are permissions available to the engine. `runHeadlessClone` does not yet require evidence that a verification command ran or succeeded before it commits a successful engine result.

Push safety is handled outside the agent process. The agent receives no `Bash(git push:*)` permission. The host orchestrator inspects the resulting worktree and performs an explicitly approved `git push --set-upstream origin <branch>` after the run. Commits are likewise created host-side with fixed argument vectors.

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

Every run produces one, so the user can review delegated work.

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

Current learning relies on explicit reusable user guidance and assessed corrections in consented sessions. Merge outcomes and rewritten diffs are a possible future source, not an implemented feedback channel. A merge or deletion alone does not establish why the user made that decision.

## What is never allowed

No tier and no allowlist entry grants any of these.

`--dangerously-skip-permissions` and `--permission-mode bypassPermissions` are never passed. Force pushes, writes to a branch a human is using, remote actions without both a policy ceiling and per-run approval, spending above an enforced run budget, and merging pull requests are forbidden. The explicit `run` invocation can still authorize its bounded local worktree and commit when no remote-action policy exists.
