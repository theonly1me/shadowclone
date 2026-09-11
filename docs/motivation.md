# Motivation and Design Philosophy

## The Problem: Repetitive Agent Onboarding

Developers who work with coding agent CLIs (Claude Code, Codex, Cursor) often find themselves repeatedly establishing context in new sessions:
- Which test runners and verification flags are standard for the repository.
- Which tools or command patterns are disallowed or discouraged.
- Architectural conventions and file boundaries that should be preserved.
- Workflow expectations around planning, editing, and commit etiquette.

While individual tool ecosystems offer per-project instructions or generic memory files, developers frequently move between multiple repositories, branches, and toolchains. Without structured memory extraction, maintaining these rules requires writing extensive manual prompts or continually correcting the agent in-session.

## The Architectural Premise: The Disk Already Knows

Supported agent CLIs can leave traces on disk:
- CLI session transcripts (JSONL logs, history databases).
- User corrections following failed tool calls or rejected proposals.
- Interruptions and denied command executions.
- Verification loops run in bash or terminal windows.

Shadowclone uses enabled local transcript history as evidence of past interactions. It parses enabled logs deterministically and reports behavioral signals locally. When the user explicitly enables deep learning, it distills redacted correction moments into human-readable profile rules through the agent CLI they already use.

## Open Source and Privacy First

Shadowclone provides inspectable local controls:

- **No project telemetry**: The code does not implement hosted Shadowclone collection, analytics, or crash reporting; model operations send selected inputs through the user's authenticated agent provider.
- **Pattern redaction**: Materialization removes recognized secret patterns and home-path prefixes, with documented false positives and missed formats.
- **Editable profiles**: Profile Markdown can be reviewed, corrected, disabled, or deleted by its owner.
- **Transfer evaluation**: Qualifying historical tasks run against baseline and cloned configurations, with independent repository checks and provisional semantic judgments of correctness and preference adherence.
- **Managed policy**: Supported root-owned configuration restricts this installation's sources, engines, and action tiers; it does not control other programs or establish organizational compliance.

See [Data handling](data-handling.md) for storage, provider transmission, retention, and execution limits.

## Not Another Agent Framework

Shadowclone is not a new agent runtime, chat client, or prompt framework. It combines capture, learning, compilation, and scoped execution: ingesting existing transcripts, extracting engineering preferences, and producing standard configuration files that existing developer agents already understand.
