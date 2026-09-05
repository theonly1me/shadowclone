# Roadmap

Build order, and what each phase has to prove before the next one starts. A phase is done when its verification passes, not when its code exists.

## Phase 0, foundation

Status: complete.

MIT `LICENSE`. `src/paths.ts` holding every path the project reads or writes. `src/config/` with all sources defaulting to off. `src/redact.ts` becomes `src/redact/` with the rules split out, keeping all twelve existing tests green and unchanged.

Proves: nothing regressed, and there is one place to look for what gets touched on disk.

## Phase 1, observe and index

Status: implementation complete. Real corpus verification requires explicit source consent.

`AgentEvent`, `TextRef`, `resolveRedacted`, the cursor, the Claude Code adapter, the SQLite index, and `shadowclone learn` doing a real ingest of the local corpus.

Proves: a full ingest completes, a second run is incremental, and a secret planted in a fixture transcript appears nowhere in the index. The wiring test is proved by mutating `resolveRedacted` to return raw bytes and watching it go red.

## Phase 2, the mirror

Status: mirror implementation complete. The pure replay scorer is built, but executable replay and real corpus tuning remain tracked in issue #14.

Structural derivation and the correction miner. `shadowclone learn` prints the profile to the terminal and writes it to `~/.shadowclone/profile/`. Zero model calls in this phase, and the first line of output says so.

Proves: the output surprises its own author. This is the quality bar for the whole project.

Run it on the real 562 MB corpus and read it. A profile that says "runs tests, uses plan mode, prefers Bun" is something a good engineer writes in five minutes. A profile that names what you interrupt the agent for, in order, with counts, is something nobody has seen. Tune the extractors until it is the second one.

Later phases build in parallel rather than waiting. They consume the profile and none of them improves it.

Also in this phase, the replay eval. Take a past session, hand its first prompt to an engine with the profile loaded, and compare what the clone did with what the user did: tools chosen, verification ritual, files touched, plan before edit. Score it. The corpus is 372 ground-truth test cases and they cost nothing. This is what turns "acts like you" from a claim into a number in the README.

The pure four-dimension scorer lands with the mirror. Connecting it to an observed engine run requires behavior extraction that does not store raw tool input, so issue #14 tracks the executable `shadowclone eval` path.

## Phase 3, the clone inside your session

Status: implementation complete. Local plugin installation and a real authenticated engine run remain manual verification.

`.claude-plugin/` with a `SessionEnd` hook and an MCP server that loads the profile into the user's live Claude Code sessions. `src/profile/agent.ts` compiles the profile into a `.claude/agents/<name>.md` subagent, so the session can dispatch copies of the user in parallel.

The engine module lands here too, since the hook needs the Claude Code runner for `learn --deep`.

Proves: install is one command, a normal session gets the user's conventions with no manual step, and `Agent(subagent_type: "<name>")` dispatches a copy of the user from inside that session.

This is the first phase where shadowclone is a clone rather than a profile, and the first thing that runs before any clone has been trusted.

## Phase 4, the clone while you are away

Status: implementation complete. A real authenticated worktree run remains manual verification.

Worktree, policy, receipt, `shadowclone run`. Ships with every allowlist empty, so the ceiling is a branch and a commit.

Proves: a task produces a worktree, a branch, a commit, and a receipt, with nothing pushed and `actionsBlockedByPolicy` correctly populated. Phase 3 has to have earned trust first, which is why this moved from third to fourth.

## Phase 5, more providers

Status: implementation complete. Real Codex and Cursor corpora and authenticated runs remain manual verification.

The Codex adapter and engine, then Cursor. Codex is a parser. Cursor is a different reader, since its chat state is a per session SQLite database rather than JSONL.

Cursor required the approved evolution of `TextRef` from a file range into a file-or-SQLite pointer and a disposable index rebuild. Provider events still required no changes to `signal` or `profile`; `distill` only changed pointer identity handling and retains the same eligibility policy. This is also the hedge against a single vendor shipping the Claude-only version natively, so it is earlier than it would otherwise be.

## Phase 6, provider capabilities and Antigravity

Status: planned in `docs/design/002-provider-expansion.md`.

Add the static provider capability registry, purpose-aware engine selection, and separate observe, distill, and dispatch support reporting. Add Antigravity's off-by-default generated-log adapter and headless engine without live-daemon scraping, plaintext sidecars, global-settings edits, or permission bypass flags.

Proves: adding a provider cannot overstate its security controls, and Antigravity can join observation and distillation without being falsely advertised for dispatch.

## Phase 7, verified provider breadth

One stacked PR per provider, initially Gemini CLI, GitHub Copilot CLI, OpenCode, Aider, and Amp. Goose, Amazon Q or Kiro, Windsurf, Cline, and newly verified transcript-producing CLIs follow the same qualification gate.

Each provider may ship observation, distillation, and dispatch independently. A provider with no local transcript stays out of observation. A provider with no enforceable no-tools mode stays out of distillation. A provider with no enforceable budget or granular tool policy stays out of dispatch.

Proves: provider breadth grows by adding registry metadata and boundary implementations rather than weakening the common pipeline.

## Later, and deliberately not now

**Learning from merge outcomes.** The diff between what a clone wrote and what the user shipped is the strongest correction signal available. It needs clone output good enough to be worth reviewing, so it waits until phase 4 has been used in anger.

**Claims about productivity multiples.** None are made until the replay eval produces a number. The honest value is bounded and measurable, the agent stops repeating corrections it has already received, and a bounded number that holds beats a large one that does not.

**A daemon.** Adds latency reduction and queued work, no new capability. The hook covers most of the value at a fraction of the moving parts.

**Task intake from issue trackers.** Picking up work assigned on GitHub or Linear is what makes "while you are away" literal. It is gated on delegation being trusted, which is gated on receipts being boring to read.

**Multiple concurrent clones.** Parallel worktrees on separate tasks, with results merged back. The name promises this and the architecture allows it, but one clone has to be good before several are useful.

**Profile sharing.** A profile is a portable markdown directory, so exporting a team lead's workflow rules is close to free. It is also the fastest way to leak an employer's internal details, so it needs a scrubbing step designed on purpose rather than a zip command.
