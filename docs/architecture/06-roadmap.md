# Roadmap

Build order, and what each phase has to prove before the next one starts. A phase is done when its verification passes, not when its code exists.

## Phase 0, foundation

MIT `LICENSE`. `src/paths.ts` holding every path the project reads or writes. `src/config/` with all sources defaulting to off. `src/redact.ts` becomes `src/redact/` with the rules split out, keeping all twelve existing tests green and unchanged.

Proves: nothing regressed, and there is one place to look for what gets touched on disk.

## Phase 1, observe and index

`AgentEvent`, `TextRef`, `resolveRedacted`, the cursor, the Claude Code adapter, the SQLite index, and `shadowclone learn` doing a real ingest of the local corpus.

Proves: a full ingest completes, a second run is incremental, and a secret planted in a fixture transcript appears nowhere in the index. The wiring test is proved by mutating `resolveRedacted` to return raw bytes and watching it go red.

## Phase 2, signal

Structural derivation and the correction miner. `shadowclone profile` writes markdown with provenance. Zero model calls in this phase.

Proves: the profile is recognisably a specific person, and the whole thing runs offline. This is the first phase with a demo.

## Phase 3, engine

`src/engine/` with the Claude Code runner, stream-json parsing, `detect.ts`, and `shadowclone doctor`. Then `learn --deep` on top, batched and checkpointed.

Proves: a headless run completes and returns a populated `EngineRun`, and killing the process mid distillation loses one batch rather than the run.

## Phase 4, dispatch

Worktree, policy, receipt, `shadowclone run`. Ships with every allowlist empty, so the ceiling is a branch and a commit.

Proves: a task produces a worktree, a branch, a commit, and a receipt, with nothing pushed and `actionsBlockedByPolicy` correctly populated.

This is the end of the first release. Everything above is the demo: read a profile of yourself, then hand a clone a task and read what it did.

## Phase 5, plugin

`.claude-plugin/` with a `SessionEnd` hook, slash commands, and an MCP server exposing profile recall to live sessions.

Proves: install is one command, and a normal Claude Code session gets the user's own conventions injected without shadowclone being run manually. This phase is the distribution vector, and it is also the first thing that pays off before any clone has ever run.

## Phase 6, more providers

The Codex adapter and engine, then Cursor. Codex is a parser. Cursor is a different reader, since its chat state is a per session SQLite database rather than JSONL.

Proves: the adapter boundary was real, by a second provider landing without changes to `signal`, `distill`, or `profile`.

## Later, and deliberately not now

**Learning from merge outcomes.** The diff between what a clone wrote and what the user shipped is the strongest correction signal available. It needs clone output good enough to be worth reviewing, so it waits until phase 4 has been used in anger.

**A daemon.** Adds latency reduction and queued work, no new capability. The hook covers most of the value at a fraction of the moving parts.

**Task intake from issue trackers.** Picking up work assigned on GitHub or Linear is what makes "while you are away" literal. It is gated on delegation being trusted, which is gated on receipts being boring to read.

**Multiple concurrent clones.** Parallel worktrees on separate tasks, with results merged back. The name promises this and the architecture allows it, but one clone has to be good before several are useful.

**Profile sharing.** A profile is a portable markdown directory, so exporting a team lead's workflow rules is close to free. It is also the fastest way to leak an employer's internal details, so it needs a scrubbing step designed on purpose rather than a zip command.
