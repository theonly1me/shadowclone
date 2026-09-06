# Shadowclone Launch Brief

## Target developer persona

The primary audience is senior and staff software engineers who use agent CLIs (Claude Code, Codex, Cursor) daily and already have dozens or hundreds of sessions on disk.

These engineers constantly repeat themselves across sessions and tools. Every new agent session forgets verified workflows, tool refusals, test patterns, and architectural boundaries. They maintain sprawling system prompts or repeated manual instructions across repositories.

They care about privacy, auditability, and deterministic behavior. They reject cloud memory SaaS tools that siphon codebases into third-party vectors.

## Core messages

**Stop teaching every new Claude Code session how you work.**
Coding sessions are already recorded on developer machines in Claude Code, Codex, and Cursor transcript files. Shadowclone turns those local historical sessions into an editable, git-scoped engineering profile without manual transcription.

**Falsifiable alignment, not vibes.**
The `shadowclone eval` command replays historical prompts across baseline and cloned profiles, measuring behavioral deltas across tool choice, bash verification commands, and planning sequences.

**Zero-trust memory.**
Captured history stays local. Redaction applies deterministic multi-provider secret regexes and Shannon entropy filtering before distillation. Enterprise teams enforce hard tool and origin ceilings via managed policy files.

## Anti-positioning: what Shadowclone is not

**Not an agent runtime.**
Shadowclone does not build another prompt loop or proprietary coding agent. It compiles memory and behavioral guidance for the agent CLIs developers already pay for and trust.

**Not a prompt pack.**
Rules are synthesized from real historical developer corrections and tool refusals, not generic prompt templates.

**Not an observability SaaS.**
Shadowclone has no hosted database, no telemetry, no user accounts, and no network egress to Shadowclone servers.

**Not a hosted service.**
All indexing, signal derivation, and distillation execution occur locally on developer workstations.

## Launch hook and narrative

The initial release highlights that cross-session alignment is solvable using data developers already generate on disk.

The rapid development arc of the project serves as an architectural proof point rather than the headline. Building a multi-provider memory compiler quickly was possible because Shadowclone avoids replicating agent runtimes, vector databases, or hosted infra, focusing strictly on local transcript indexing, deterministic signal derivation, and CLI delegation.

## Community engagement plan

**Claude Code developers.**
Highlight native subagent compilation via `.claude/agents/shadowclone.md` and session hooks that automatically maintain the profile.

**Cursor and Codex developers.**
Highlight local transcript indexing across multi-turn sessions and direct integration through MCP and context references.

**Enterprise and platform leads.**
Highlight the managed policy tier (`/etc/shadowclone/policy.toml` and `%ProgramData%\shadowclone\policy.toml`) enabling security teams to restrict sources and set repository ceilings fleet-wide.
