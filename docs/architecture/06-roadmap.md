# Roadmap

Build order, and what each phase has to prove before the next one starts. A phase is done when its verification passes, not when its code exists.

## Phase 0, foundation

Status: complete.

MIT `LICENSE`. `src/paths.ts` holding every path the project reads or writes. `src/config/` with all sources defaulting to off. `src/redact.ts` becomes `src/redact/` with the rules split out, keeping all twelve existing tests green and unchanged.

Proves: nothing regressed, and there is one place to look for what gets touched on disk.

## Phase 1, observe and index

Status: implementation complete. Session-based verification requires explicit source consent.

`AgentEvent`, `TextRef`, `resolveRedacted`, the cursor, the Claude Code adapter, the SQLite index, and `shadowclone learn` doing a real ingest of the local corpus.

Proves: a full ingest completes, a second run is incremental, and a secret planted in a fixture transcript appears nowhere in the index. The wiring test is proved by mutating `resolveRedacted` to return raw bytes and watching it go red.

## Phase 2, the mirror

Status: mirror implementation complete. The pure replay scorer remains a utility. Executable evaluation now uses the transfer evaluator; paid evaluation remains deferred.

Structural derivation and the correction miner. `shadowclone learn` prints aggregate evidence and a deep-learning preview while leaving the profile unchanged. It makes zero model calls, and the first line of output says so.

Declared repository guidance follows a second zero-model path. `shadowclone import` synchronizes supported root instructions and direct agent skills into repository-scoped profile rules after separate consent. It preserves user edits and rejections through the same profile lifecycle used by learned rules.

Proves: the output surprises its own author. This is the quality bar for the whole project.

Evaluate aggregate correction counts across enabled sessions and inspect whether the report identifies useful repeated steering. Structural counts do not establish alignment, task quality, or productivity.

Explicit deep learning turns eligible moments into mined profile rules. Executable evaluation now uses the [transfer evaluator](09-evaluation.md), which tests qualifying tasks for correctness and preference adherence. It consumes provider quota and remains unrun for this remediation.

## Phase 3, the clone inside your session

Status: implementation complete. Local plugin installation and a real authenticated engine run remain manual verification.

`.claude-plugin/` with a `SessionEnd` hook and an MCP server that loads the profile into the user's live Claude Code sessions. `src/profile/agent.ts` compiles the profile into a `.claude/agents/<name>.md` subagent, so the session can dispatch copies of the user in parallel.

The engine module lands here too for explicit `learn --deep`. Deep learning reconciles exact, redacted correction evidence with existing rules and rejected guidance, preserves user authority during disagreement, and withholds mined candidates until three independent sessions support them. The session-end hook ingests its exact transcript and recompiles existing guidance for that repository scope without generating rules or calling an engine.

Proves: install is one command, a normal session gets the user's conventions with no manual step, and `Agent(subagent_type: "<name>")` dispatches a copy of the user from inside that session.

This is the first phase where shadowclone is usable through a live agent, and the first thing that runs before any clone has been trusted.

## Phase 4, the clone while you are away

Status: implementation complete. A real authenticated worktree run remains manual verification.

Worktree, policy, receipt, `shadowclone run`. Ships with every allowlist empty, so the ceiling is a branch and a commit.

Proves: a task produces a worktree, a branch, a commit, and a receipt, with nothing pushed and `actionsBlockedByPolicy` correctly populated. Phase 3 has to have earned trust first, which is why this moved from third to fourth.

## Phase 5, more providers

Status: implementation complete. Codex and Cursor session parsing and authenticated runs remain manual verification.

The Codex adapter and engine, then Cursor. Codex is a parser. Cursor is a different reader, since its chat state is a per session SQLite database rather than JSONL.

Cursor required the approved evolution of `TextRef` from a file range into a file-or-SQLite pointer and a disposable index rebuild. Provider events still required no changes to `signal` or `profile`; `distill` only changed pointer identity handling and retains the same eligibility policy. This is also the hedge against a single vendor shipping the Claude-only version natively, so it is earlier than it would otherwise be.

## Phase 6, provider capabilities and Antigravity

Status: implementation complete. Antigravity session verification requires explicit source consent.

Add the static provider capability registry, purpose-aware engine selection, and separate observe, distill, and dispatch support reporting. Add Antigravity's off-by-default generated-log adapter. Record its engine capabilities, but do not add a runner while the CLI lacks a per-run deny-all tool policy.

Proves: adding a provider cannot overstate its security controls, and Antigravity can join observation without being falsely advertised for distillation or dispatch.

## Phase 7, verified provider breadth

One stacked PR per provider, initially GitHub Copilot CLI, OpenCode, Aider, and Amp. Gemini CLI is excluded in favor of its Antigravity successor. Goose, Amazon Q or Kiro, Windsurf, Cline, and newly verified transcript-producing CLIs follow the same qualification gate.

Each provider may ship observation, distillation, and dispatch independently. A provider with no local transcript stays out of observation. A provider with no enforceable no-tools mode stays out of distillation. A provider with no enforceable budget or granular tool policy stays out of dispatch.

Proves: provider breadth grows by adding registry metadata and boundary implementations that preserve the common pipeline.

## Later, and deliberately not now

**Learning from merge outcomes.** The diff between what a clone wrote and what the user shipped is the strongest correction signal available. It needs clone output good enough to be worth reviewing, so it waits until phase 4 has been used in anger.

**Claims about productivity multiples.** No improvement is claimed without a measurement designed to support it. Transfer-evaluation outcomes do not measure user correction time or productivity.

**A daemon.** Adds latency reduction and queued work, no new capability. The hook covers most of the value at a fraction of the moving parts.

**Task intake from issue trackers.** Picking up work assigned on GitHub or Linear is what makes "while you are away" literal. It is gated on delegation being trusted, which is gated on receipts being boring to read.

**Multiple concurrent clones.** Parallel worktrees on separate tasks, with results merged back. The name promises this and the architecture allows it, but one clone has to be good before several are useful.

**Profile sharing.** A profile is a portable markdown directory, so exporting a team lead's workflow rules is close to free. It is also the fastest way to leak an employer's internal details, so any sharing feature needs a separate review and disclosure design.
