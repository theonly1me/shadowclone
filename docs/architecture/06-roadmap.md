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

Status: mirror implementation complete. Real corpus tuning requires explicit source consent.

Structural derivation and the correction miner. `shadowclone learn` prints aggregate evidence and a deep-learning preview while leaving the profile unchanged. It makes zero model calls, and the first line of output says so.

Declared repository guidance follows a second zero-model path. `shadowclone import` synchronizes supported root instructions and direct agent skills into repository-scoped profile rules after separate consent. It preserves user edits and rejections through the same profile lifecycle used by learned rules.

Proves: the output surprises its own author. This is the quality bar for the whole project.

Run it on the real 562 MB corpus and read it. A profile that says "runs tests, uses plan mode, prefers Bun" is something a good engineer writes in five minutes. A profile that names what you interrupt the agent for, in order, with counts, is something nobody has seen. Tune the extractors until it is the second one.

Later phases consume the measured moments. Explicit deep learning in phase 3 is the path that turns them into mined profile rules.

## Phase 3, the environment inside your session

Status: implementation complete. Local plugin installation and a real authenticated engine run remain manual verification.

`.claude-plugin/` with lifecycle hooks and an MCP server loads the profile into the user's live Claude Code sessions. `src/profile/agent.ts` also supports an optional `.claude/agents/<name>.md` subagent for independent delegated work.

The engine module lands here too for explicit `learn --deep`. Deep learning reconciles exact, redacted correction evidence with existing rules and rejected guidance, preserves user authority during disagreement, and withholds mined candidates until three independent sessions support them. The session-end hook ingests its exact transcript and recompiles existing guidance for that repository scope without generating rules or calling an engine.

Proves: install is one command, a normal session gets the user's conventions with no manual step, and an optional `Agent(subagent_type: "<name>")` dispatches a copy of the user when delegation is useful.

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

Status: implementation complete. Authenticated evaluation remains a release gate.

Default to global main-agent delivery through stable provider pointers and live scoped session hooks. Let the active agent request bounded learning for a useful session through an opaque token, and interpret an interruption with the user's following message. Activate explicit reusable guidance from one session while keeping inferred guidance behind three independent sessions.

Install complete starter skills into a canonical personal library and synchronize copies across Claude Code, Codex, Cursor, and Antigravity-compatible locations. Preserve user edits, expose divergent copies as conflicts, and let enabled deep learning keep managed preference additions current.

Replace historical-only transfer selection with fresh additive coding tasks on current HEAD. Run snapshot preflight before measured spend, prohibit permanent and external actions, review bounded code changes through three blinded paired votes, expose persisted stage progress, and report success, adherence, lift, paired outcomes, and regressions.

Proves: the user's ordinary agent sees current guidance without selecting a custom subagent, personal workflows survive provider changes, learning happens only from deliberately useful sessions, and evaluation always returns a quantified pass, fail, or infrastructure error.

Launch readiness adds a `SubagentStart` hook so spawned Claude subagents inherit the current profile, a three-question default setup with a bounded first learning pass, concurrent reconciliation, and independent eval snapshots with concurrent arms and judging. The subagents' sessions add to the consented corpus used for later learning. Authenticated transfer evaluation remains the release gate.

## Phase 8, verified provider breadth

One stacked PR per provider, initially GitHub Copilot CLI, OpenCode, Aider, and Amp. Gemini CLI is excluded in favor of its Antigravity successor. Goose, Amazon Q or Kiro, Windsurf, Cline, and newly verified transcript-producing CLIs follow the same qualification gate.

Each provider may ship observation, distillation, and dispatch independently. A provider with no local transcript stays out of observation. A provider with no enforceable no-tools mode stays out of distillation. A provider with no enforceable budget or granular tool policy stays out of dispatch.

Proves: provider breadth grows through registry metadata and boundary implementations while keeping the common pipeline intact.

## Later, and deliberately not now

**Learning from merge outcomes.** The diff between what a clone wrote and what the user shipped is the strongest correction signal available. It needs clone output good enough to be worth reviewing, so it waits until phase 4 has been used in anger.

**Claims about productivity multiples.** None are made until the fresh transfer evaluation produces a decision-grade result. The honest value is bounded and measurable, and a number that holds beats a large one that does not.

**A daemon.** Adds latency reduction and queued work, no new capability. The hook covers most of the value at a fraction of the moving parts.

**Task intake from issue trackers.** Picking up work assigned on GitHub or Linear is what makes "while you are away" literal. It is gated on delegation being trusted, which is gated on receipts being boring to read.

**Multiple concurrent clones.** Parallel worktrees on separate tasks, with results merged back. The name promises this and the architecture allows it, but one clone has to be good before several are useful.

**Profile sharing.** A profile is a portable markdown directory, so exporting a team lead's workflow rules is close to free. It could leak an employer's internal details, so it needs a deliberate scrubbing step.
