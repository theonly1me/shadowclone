# Roadmap

Implementation milestones and remaining validation. Earlier phases describe build order, not the current user workflow. Current behavior is documented in the other architecture pages; [the early evaluation report](../../evals.md) records the evidence available so far.

## Phase 0, foundation

Status: complete.

MIT `LICENSE`. `src/paths.ts` holding every path the project reads or writes. `src/config/` with all sources defaulting to off. `src/redact.ts` becomes `src/redact/` with the rules split out, keeping all twelve existing tests green and unchanged.

Proves: nothing regressed, and there is one place to look for what gets touched on disk.

## Phase 1, observe and index

Status: implementation complete. Real corpus verification requires explicit source consent.

`AgentEvent`, `TextRef`, `resolveRedacted`, the cursor, the Claude Code adapter, the SQLite index, and `shadowclone learn` doing a real ingest of the local corpus.

Proves: a full ingest completes, a second run is incremental, and a secret planted in a fixture transcript appears nowhere in the index. The wiring test is proved by mutating `resolveRedacted` to return raw bytes and watching it go red.

## Phase 2, the mirror

Status: mirror implementation complete. Real corpus tuning requires explicit source consent.

Structural derivation and the correction miner. `shadowclone learn` prints aggregate evidence and a deep-learning preview while leaving the profile unchanged. It makes zero model calls, and the first line of output says so.

Declared repository guidance follows a second zero-model path. `shadowclone import` synchronizes supported root instructions and direct agent skills into repository-scoped profile rules after separate consent. It preserves user edits and rejections through the same profile lifecycle used by learned rules.

Proves: the report accurately counts supported interaction markers without presenting them as learned instructions. Fixture checks cover the distinction; assessment of learning quality uses separately consented evidence.

Later phases consume the measured moments. Explicit deep learning in phase 3 is the path that turns them into mined profile rules.

## Phase 3, the environment inside your session

Status: implementation complete. Local plugin installation and a real authenticated engine run remain manual verification.

`.claude-plugin/` with lifecycle hooks and an MCP server loads the profile into the user's live Claude Code sessions. `src/profile/agent.ts` also supports an optional `.claude/agents/<name>.md` subagent for independent delegated work.

The engine module supports explicit `learn --deep`. Current learning reconciles redacted user steering with existing rules and rejected guidance. Explicit reusable guidance can activate from one session; inferred guidance needs three independent sessions. The legacy plugin end hook ingests and recompiles existing guidance. Native automatic learning additionally requires a useful-session request and separate consent.

Proves: normal sessions receive the scoped profile through supported native delivery, and optional delegated work receives the same guidance. Successful delivery does not itself prove adherence.

This is the first phase where shadowclone can act as a clone inside the user's session, and the first thing that runs before any clone has been trusted.

## Phase 4, the clone while you are away

Status: implementation complete. A real authenticated worktree run remains manual verification.

Worktree, policy, receipt, `shadowclone run`. Ships with every allowlist empty, so the ceiling is a branch and a commit.

Proves: a task produces a worktree, a branch, a commit, and a receipt, with nothing pushed and `actionsBlockedByPolicy` correctly populated. Phase 3 has to have earned trust first, which is why this moved from third to fourth.

## Phase 5, more providers

Status: implementation complete. Real Codex and Cursor corpora and authenticated runs remain manual verification.

The Codex adapter and engine, then Cursor. Codex is a parser. Cursor reads per-session SQLite chat state.

Cursor required the approved evolution of `TextRef` from a file range into a file-or-SQLite pointer and a disposable index rebuild. Provider events still required no changes to `signal` or `profile`; `distill` only changed pointer identity handling and retains the same eligibility policy. This is also the hedge against a single vendor shipping the Claude-only version natively, so it is earlier than it would otherwise be.

## Phase 6, provider capabilities and Antigravity

Status: implementation complete. Real Antigravity corpus verification requires explicit source consent.

Add the static provider capability registry, purpose-aware engine selection, and separate observe, distill, dispatch, and native-delivery support reporting. Add Antigravity's off-by-default generated-log adapter and native hook locations. Record its engine capabilities, but do not add a runner while the CLI lacks a per-run deny-all tool policy.

Proves: adding a provider cannot overstate its security controls, and Antigravity can join observation without being falsely advertised for distillation or dispatch.

## Phase 7, self-improving portable environment

Status: implementation complete, including judging and recovery repairs. Four exploratory tasks have completed across all three arms. Repeated-run validation, known judge issues, and broader provider qualification remain open.

Default to global main-agent delivery through stable provider pointers and live scoped session hooks. Let the active agent request bounded learning for a useful session through an opaque token, and interpret an interruption with the user's following message. Activate explicit reusable guidance from one session while keeping inferred guidance behind three independent sessions.

Install complete starter skills into a canonical personal library and synchronize copies across Claude Code, Codex, Cursor, and Antigravity-compatible locations. Preserve user edits, expose divergent copies as conflicts, and let enabled deep learning keep managed preference additions current.

Use fresh additive coding tasks on current HEAD for transfer evaluation. Run snapshot preflight before measured spend, prohibit permanent and external actions, and compare repository-only Bare, personal-context Skills, and profile-equipped Clone. Freeze source-backed code criteria, save three independent votes per criterion, resume missing judging work, and report completion separately from preference lift and correctness.

Proves: native delivery carries current guidance, portable copies preserve user ownership, and learning requires an explicitly useful session. Evaluation must retain completed work and make incomplete or failed grading visible. It is valid for the profile-equipped arm to tie or lose.

Launch readiness adds a `SubagentStart` hook so spawned Claude subagents inherit the current profile, a three-question default setup with a bounded first learning pass, concurrent reconciliation, and independent eval snapshots with concurrent arms. Only eligible user steering from consented sessions can update learned guidance. The current evaluation evidence does not establish a productivity gain or broad launch readiness.

## Phase 8, verified provider breadth

Qualify additional providers one at a time. Candidate integrations are a backlog, not promised support. Each needs current documentation or clean-room format notes, synthetic fixtures, and enforceable controls before its support is advertised.

Each provider may ship observation, distillation, and dispatch independently. A provider with no local transcript stays out of observation. A provider with no enforceable no-tools mode stays out of distillation. A provider with no enforceable budget or granular tool policy stays out of dispatch.

Proves: provider breadth grows through registry metadata and boundary implementations while keeping the common pipeline intact.

## Later, and deliberately not now

**Learning from merge outcomes.** User revisions may provide useful evidence, but merge or deletion alone does not establish intent. This source is not implemented.

**Claims about productivity multiples.** Preference evaluation does not measure productivity. A time-saving claim needs a separate study, even if preference scores improve.

**A daemon.** Adds latency reduction and queued work, no new capability. The hook covers most of the value at a fraction of the moving parts.

**Task intake from issue trackers.** Picking up work assigned on GitHub or Linear is what makes "while you are away" literal. It is gated on delegation being trusted, which is gated on receipts being boring to read.

**Multiple concurrent clones.** Parallel worktrees on separate tasks need coordination, conflict handling, and measured usefulness before becoming a supported workflow.

**Profile sharing.** A profile is a portable markdown directory, so exporting a team lead's workflow rules is close to free. It could leak an employer's internal details, so it needs a deliberate scrubbing step.
