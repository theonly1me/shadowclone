# Architecture

Shadowclone learns how you work with AI coding agents, then does your work the way you would when you are not there.

It learns from the transcripts your agents already write to disk. It acts by driving the agent CLIs you already pay for. It never holds an API key and it has no server.

## Documents

| File | Covers |
| --- | --- |
| `01-capture.md` | What gets read, how it is normalized, how it stays incremental |
| `02-profile.md` | How raw sessions become a behavioral profile you can read and edit |
| `03-engine.md` | Driving the user's own agent subscriptions instead of an API key |
| `04-acting.md` | How a clone runs a task, and the ceiling on what it may do |
| `05-privacy.md` | The egress gate, retention, consent, and the one-step wipe |
| `06-roadmap.md` | Build order and what is deliberately not built yet |
| `07-enterprise.md` | Organization boundaries, and what to hand a security reviewer |

Per-change design docs live in `docs/design/`, one file per change, written against `docs/design/template.md`.

## The loop

```
observe  ->  index  ->  signal  ->  distill  ->  profile  ->  dispatch
                          |                        |            |
                     zero tokens          user's own subscription
```

| Stage | Module | What it does |
| --- | --- | --- |
| observe | `src/observe/` | Normalizes agent transcripts into one event stream |
| index | `src/index/` | A rebuildable SQLite cache of pointers and skeletons |
| signal | `src/signal/` | Derives behavior in pure code, no model, no network |
| distill | `src/distill/` | Turns high signal moments into written rules |
| profile | `src/profile/` | Plain markdown you can read, edit, and diff |
| dispatch | `src/dispatch/` | Runs a task in a worktree and leaves a receipt |
| engine | `src/engine/` | The one way a model gets called, by any stage |

`src/cli/` is the only place that knows about more than one stage. Stage modules depend downward and never sideways, which is what keeps the egress path auditable by reading one file.

## Why agent transcripts

The first version of this project read `~/.zsh_history`. That was the wrong input and the mistake is worth recording, because it is the mistake most "learn from the user" tools make.

Shell history records what a person typed into a terminal. It shows `git status`, `bun test`, and a lot of `cd`. It does not show why they chose an approach, what they rejected, how they verify work before calling it done, or what they refuse to let an agent do. Most people are not heavy terminal users, so for most people the file is close to empty. Nothing in it teaches a clone to act like its owner.

Agent transcripts record the opposite. They are a turn by turn recording of a person steering an agent, which is exactly the job the clone has to do. On the development machine this was designed against, `~/.claude/projects/` holds 372 transcripts, 562 MB, 175,218 records and 43,022 tool calls across 30 active days. `~/.claude/history.jsonl` holds 742 prompts in the user's own words. `~/.codex/sessions/` holds the same thing for Codex.

Every Claude Code and Codex user is producing that corpus right now and nothing reads it. It is the highest quality behavioral data on the machine and it is free.

## Why the user's own subscription

Shadowclone calls no model API of its own. It shells out to `claude`, `codex`, or `cursor-agent`, which are already installed and already authenticated.

This is a product decision before it is a technical one. Asking a new user to paste an API key is the single largest drop off in a local AI tool, and it puts the maintainer on the hook for other people's inference bills. Driving the installed CLI removes both. If you can run `claude`, you can run shadowclone.

It also produces the clearest privacy statement the project can make. Shadowclone sends nothing anywhere your own agent is not already sending it, under your own account, on your own plan. `03-engine.md` covers the abstraction and the fallbacks, including a fully local path through Ollama for people who want zero egress.

## What is settled and what is not

Five questions were open in the previous version of this document. Four are now closed.

**Should the distiller be provider agnostic.** Yes, and `src/engine/` is the abstraction. See `03-engine.md`.

**What is the vault's schema, and is it files or a database.** Both, split by purpose. Plain markdown holds what was learned about the user, because a user who cannot read what was learned about them cannot consent to it. SQLite holds offsets and skeletons, and is declared a disposable cache that can be deleted and rebuilt. See `02-profile.md`.

**What triggers the clone.** A CLI command, a Claude Code `SessionEnd` hook, or a long running daemon, in that order of arrival. Incremental cursors make all three cheap. See `01-capture.md`.

**How does the act stage get its capabilities.** It does not get capabilities of its own. It borrows the agent CLI's tools and narrows them with a per repo policy. See `04-acting.md`.

**What is the retention window.** Still open, and it is now a smaller question than it was, because shadowclone stores pointers rather than copies. See `05-privacy.md`.
