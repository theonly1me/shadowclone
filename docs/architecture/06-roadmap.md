# Roadmap

Build order, and what each phase has to prove before the next one starts. A phase is done when its verification passes, not when its code exists.

## Phase 0, foundation

MIT `LICENSE`. `src/paths.ts` holding every path the project reads or writes. `src/config/` with all sources defaulting to off. `src/redact.ts` becomes `src/redact/` with the rules split out, keeping all twelve existing tests green and unchanged.

Proves: nothing regressed, and there is one place to look for what gets touched on disk.

## Phase 1, observe and index

`AgentEvent`, `TextRef`, `resolveRedacted`, the cursor, the Claude Code adapter, the SQLite index, and `shadowclone learn` doing a real ingest of the local corpus.

Proves: a full ingest completes, a second run is incremental, and a secret planted in a fixture transcript appears nowhere in the index. The wiring test is proved by mutating `resolveRedacted` to return raw bytes and watching it go red.

## Phase 2, the mirror

Structural derivation and the correction miner. `shadowclone learn` prints the profile to the terminal and writes it to `~/.shadowclone/profile/`. Zero model calls in this phase, and the first line of output says so.

Proves: the output surprises its own author. This is the go/no-go for the project. Run it on the real 562 MB corpus and read it with fresh eyes. A profile that says "runs tests, uses plan mode, prefers Bun" is something a good engineer writes in five minutes and nobody shares. A profile that names what you interrupt the agent for, in order, with counts, is something nobody has seen. Iterate on the extractors until the second one is true. Nothing past this phase is worth building until it is.

Also in this phase, the replay eval. Take a past session, hand its first prompt to an engine with the profile loaded, and compare what the clone did with what the user did: tools chosen, verification ritual, files touched, plan before edit. Score it. The corpus is 372 ground-truth test cases and they cost nothing. This is what turns "acts like you" from a claim into a number in the README.

## Phase 3, the fix

`.claude-plugin/` with a `SessionEnd` hook and an MCP server that loads the user's own profile into their own live Claude Code sessions. The engine module lands here too, since the hook needs the Claude Code runner for `learn --deep`.

Proves: install is one command, and a normal session gets the user's conventions with no manual step. This is where daily value and retention come from, because the user feels the difference the same day in work they were already doing, and it is the first thing that runs before any clone has ever been trusted.

## Phase 4, the clone

Worktree, policy, receipt, `shadowclone run`. Ships with every allowlist empty, so the ceiling is a branch and a commit.

Proves: a task produces a worktree, a branch, a commit, and a receipt, with nothing pushed and `actionsBlockedByPolicy` correctly populated. Phase 3 has to have earned trust first, which is why this moved from third to fourth.

## Phase 5, more providers

The Codex adapter and engine, then Cursor. Codex is a parser. Cursor is a different reader, since its chat state is a per session SQLite database rather than JSONL.

Proves: the adapter boundary was real, by a second provider landing without changes to `signal`, `distill`, or `profile`. This is also the hedge against a single vendor shipping the Claude-only version natively, so it is earlier than it would otherwise be.

## Later, and deliberately not now

**Learning from merge outcomes.** The diff between what a clone wrote and what the user shipped is the strongest correction signal available. It needs clone output good enough to be worth reviewing, so it waits until phase 4 has been used in anger.

**Claims about productivity multiples.** None are made until the replay eval produces a number. The honest value is bounded and measurable, the agent stops repeating corrections it has already received, and a bounded number that holds beats a large one that does not.

**A daemon.** Adds latency reduction and queued work, no new capability. The hook covers most of the value at a fraction of the moving parts.

**Task intake from issue trackers.** Picking up work assigned on GitHub or Linear is what makes "while you are away" literal. It is gated on delegation being trusted, which is gated on receipts being boring to read.

**Multiple concurrent clones.** Parallel worktrees on separate tasks, with results merged back. The name promises this and the architecture allows it, but one clone has to be good before several are useful.

**Profile sharing.** A profile is a portable markdown directory, so exporting a team lead's workflow rules is close to free. It is also the fastest way to leak an employer's internal details, so it needs a scrubbing step designed on purpose rather than a zip command.
