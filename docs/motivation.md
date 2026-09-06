# Motivation and Design Philosophy

## The Problem: Repetitive Agent Onboarding

Developers who work with coding agent CLIs (Claude Code, Codex, Cursor) often find themselves repeatedly establishing context in new sessions:
- Which test runners and verification flags are standard for the repository.
- Which tools or command patterns are disallowed or discouraged.
- Architectural conventions and file boundaries that should be preserved.
- Workflow expectations around planning, editing, and commit etiquette.

While individual tool ecosystems offer per-project instructions or generic memory files, developers frequently move between multiple repositories, branches, and toolchains. Without structured memory extraction, maintaining these rules requires writing extensive manual prompts or continually correcting the agent in-session.

## The Architectural Premise: The Disk Already Knows

Every interaction with an agent CLI leaves traces on disk:
- CLI session transcripts (JSONL logs, history databases).
- User corrections following failed tool calls or rejected proposals.
- Interruptions and denied command executions.
- Verification loops run in bash or terminal windows.

Rather than relying on third-party cloud vectors or proprietary memory databases, Shadowclone treats local transcript history as a verifiable data source. By parsing local logs deterministically, extracting behavioral signals, and synthesizing human-readable guidelines, developers can compile persistent profiles directly from their everyday work.

## Open Source and Privacy First

Shadowclone is designed with strict boundaries suited for privacy-conscious developers and engineering organizations:
- **Zero telemetry**: No outbound network requests are made to hosted Shadowclone services. No usage statistics, tokens, or transcript contents leave your machine.
- **Local-first redaction**: Sensitive data (API tokens, private keys, authorization headers, absolute home paths) are redacted deterministically using regular expressions and Shannon entropy checks before any optional semantic distillation.
- **Human-editable profiles**: Output profiles are plain Markdown (`~/.shadowclone/profile/` and `.claude/agents/shadowclone.md`). Engineers can review, modify, or delete any rule at any time.
- **Falsifiable evaluation**: Rather than trusting subjective impressions, `shadowclone eval` replays benchmark prompts from historical sessions against both baseline and cloned configurations to measure delta in tool selection, file modifications, and verification runs.
- **Managed policy compliance**: For teams working with proprietary code, system administrators can define immutable policy files (`/etc/shadowclone/policy.toml`) to enforce capture source consent and action ceilings fleet-wide.

## Not Another Agent Framework

Shadowclone is not a new agent runtime, chat client, or prompt framework. It operates purely as a compiler: ingesting existing transcripts, extracting engineering preferences, and producing standard configuration files that existing developer agents already understand.
