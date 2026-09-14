# Learn from agent transcripts through authenticated agent CLIs

This records the original transcript-pivot decision. The [architecture](../architecture/README.md) describes the current implementation; later design records refine learning, scope, and native delivery.

## Summary

Use consented coding-agent sessions to learn how a user steers an agent. Store an editable profile and apply it through authenticated agent CLIs. Shell history remains an optional source, but it cannot capture the reasoning and corrections available in a conversation.

## Problem

Terminal commands show what ran. They rarely explain why an approach was rejected, which convention mattered, or what verification the user expected. User corrections in agent sessions provide more direct evidence for those preferences.

The original implementation also required a model API key. Driving an already authenticated agent CLI avoids that additional setup for supported providers. Model use still consumes the user's account quota and sends the supplied context to that provider.

Adding multiple transcript adapters required a clear boundary between locating an event and reading its text. A redaction call at each consumer would be easy to omit.

## Design

The pipeline separates observation, indexing, signal derivation, distillation, profile storage, and execution. Model requests go through `src/engine/`.

Events carry a `TextRef` locator. The index stores event skeletons and cursors, not transcript bodies. `resolveRedacted` selects eligible text and applies `redactSecrets` when materializing an excerpt for learning.

Incremental cursors avoid rescanning unchanged files. Truncated files trigger a rescan, and incomplete trailing records wait for a later ingest. Cursor-based database sources use their own adapters.

Structural signals require no model. Semantic learning uses bounded user steering and relevant assistant context. Tool-result bodies, file-operation contents, thinking blocks, and data-access results are excluded from distillation.

The profile is local Markdown with provenance. User edits take precedence, and rejected rules stay rejected. The current compiler produces bounded guidance for the selected repository. See [profile architecture](../architecture/02-profile.md) for activation, scope, and compilation.

Repository and owner scope keep local guidance from being applied to unrelated projects. The original proposal to promote a rule after observing it under two owners was not retained. Global rules require explicit, globally scoped evidence or a user-directed change.

Managed policy can disable sources and constrain execution. User configuration cannot widen those limits.

The initial design emphasized Claude subagents. Native main-agent delivery is now the default, with optional delegated agents and headless worktree execution. [Design 017](017-self-improving-agent-environment.md) records that change.

Dispatch creates an isolated worktree and records the outcome. A `shadowclone run` invocation approves one local task, branch, and commit. Remote actions also require a repository policy ceiling and matching per-run approval. Unsupported enforcement capabilities fail closed.

## Data handling

Capture contents are opt-in by source. Git metadata has separate consent. Current onboarding allows only the bounded presence check described in [capture architecture](../architecture/01-capture.md) before content consent.

The index contains locators and metadata. Profile rules and learning checkpoints remain local under the user's control. Redacted learning excerpts may reach the selected provider. Redaction reduces exposure; it does not establish anonymity.

Learning's capture restrictions do not describe every execution mode. An authorized coding task can expose repository code to its agent, and transfer evaluation sends generated code to judges. [Privacy architecture](../architecture/05-privacy.md) documents those boundaries.

## Alternatives

- Shell history alone provides command patterns but little explicit preference evidence.
- A hosted inference proxy adds infrastructure and another data recipient.
- Direct API integration adds a separate setup path; it remains outside the implemented engine set.
- Storing excerpts in the index speeds later reads but creates an additional transcript-content store.
- A pooled profile loses repository boundaries.
- An opaque profile store makes user inspection and correction harder.

## Accepted costs

Locators can become unreadable when a source transcript changes or is removed. The resolver must handle that without using unrelated content.

Learning can infer an incorrect rule. Evidence, user editing, and rejection handling make those errors inspectable, but do not prevent every mistake.

Scope limits how quickly a preference becomes broadly available. Excluding tool results also gives up potentially useful context.

CLI authentication does not make inference free or offline. Providers differ in the execution controls they expose, and unsupported capabilities must not be approximated silently.

## Verification

Adapter fixtures exercise the real path from source record to redacted excerpt, including planted synthetic secrets and excluded fields. Index fixtures cover repeated ingest, truncation, and partial records.

Scope fixtures check that unrelated repository rules do not enter compilation. Managed-policy fixtures check that user settings cannot widen a ceiling.

Engine fixtures parse provider output without launching paid model calls. Live provider verification is separate. Dispatch fixtures cover worktree isolation, policy enforcement, and receipts.

The current gate is `bun run check`. Later records describe [incremental learning repair](018-incremental-learning-repair.md), [launch-readiness changes](019-launch-readiness.md), and [preference judging and recovery](020-preference-judging.md).

## Decision record

Agent sessions became the primary learning source. Locators separate indexing from captured text, redaction applies when eligible learning text is resolved, and profiles remain editable local files.

Authenticated CLIs provide model execution. Repository scope, managed limits, and per-run approvals constrain where guidance and actions apply. Later designs extend native delivery without removing those boundaries.
