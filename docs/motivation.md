# Motivation

## The problem

Developers using Claude Code, Codex, Cursor, or Antigravity re-establish the same context in every new session. Which command verifies a change. Which patterns the repository avoids. How much to touch in one pass. When to ask before acting.

Per-project instruction files help inside one repository. They do not follow a developer across repositories, branches, or agent products, and they record what someone remembered to write down instead of how that person actually works.

## The evidence already on disk

Agent CLIs write session transcripts as they go. Those transcripts hold the corrections a developer makes, the plans they reject, the commands they interrupt, and the preferences they state in their own words.

Shadowclone reads those transcripts and derives engineering preferences from them. It runs no background process and needs no API key, because the data is already on disk and the analysis runs through the developer's own authenticated agent CLI.

## What it produces

A profile of plain Markdown rules under `~/.shadowclone/profile/`, each scoped to the git remote it was learned from. One deterministic compiler turns that profile into the guidance every agent sees, capped at 16 KiB.

`shadowclone install` delivers the profile to the main agent through native session hooks, so ordinary sessions receive it without anyone selecting a subagent. Subagents and headless worktree runs stay available as options.

## Boundaries

**Consent per source.** Every capture source is named in `~/.shadowclone/config.toml` and defaults to off. `shadowclone init` is the only thing that turns one on, and it names each source as it does.

**One egress gate.** `redactSecrets` sits inside the only function that turns a stored pointer into text. Secrets are matched by pattern and by Shannon entropy before anything reaches a model. Tool results, file contents, and thinking blocks never enter distillation at all.

**Local storage.** The profile is Markdown a developer can read, edit, or delete. The index is a rebuildable SQLite cache of pointers, never captured text. Nothing is uploaded or backed up, and `shadowclone forget --all` removes all of it in one step.

**Approval to act.** Observing, deriving, and drafting run unattended. Anything that sends, commits, pushes, or spends asks first, for each action.

**Managed policy.** An administrator can install an immutable policy at `/Library/Application Support/shadowclone/managed.json` on macOS or `/etc/shadowclone/managed.json` on Linux. It restricts sources, engines, distillation, and the action ceiling across a fleet.

## Measuring whether it helps

`shadowclone eval` generates fresh coding tasks from a repository's current commit and runs each one twice in matched disposable snapshots, once with the profile and once without. Three blinded paired code reviews grade correctness and preference adherence.

The report states task success, adherence lift, paired wins and losses, regressions, and sample size. A run of one task once is labelled as a smoke test and does not support a decision.
