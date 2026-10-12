# Learning from agent transcripts

## Problem

Shell history records commands but rarely explains why a user rejected an approach or asked for a different workflow. Corrections in coding-agent conversations provide more direct evidence. A separate model API key also added setup for users who already had an authenticated agent CLI.

## Decision

Learn from consented sessions through a pipeline of observation, indexing, signal derivation, and semantic learning. Send model requests through the engine boundary, using an authenticated CLI and its provider limits.

Events carry `TextRef` locators. The index stores event metadata and incremental cursors without transcript bodies. `resolveRedacted` reads eligible excerpts and applies redaction. Learning excludes tool results, file-operation contents, thinking blocks, and data-access results.

Keep derived guidance in editable local files with provenance. Preserve user edits and rejections. Repository and remote-owner scope stops guidance from spreading to unrelated projects. Global guidance needs explicit global evidence or a direct user decision. Git metadata has its own consent.

Learning publishes portable skills and native routing, as [skills delivery](023-skills-as-delivery.md) describes. That delivery keeps these consent and scope boundaries.

## Consequences

Locators can become unreadable when transcripts change or disappear. Resolution must fail without substituting unrelated text. Incremental adapters must handle truncation and incomplete trailing records.

Authenticated CLIs avoid another credential setup. But inference still sends context to a provider, and the provider's usage limits apply. Redaction reduces exposure but does not guarantee anonymity. Qualify provider capabilities separately.

## Verification

Use synthetic adapter fixtures to test source records through the redaction boundary, including excluded fields and planted secrets. Check incremental ingestion, scope isolation, managed-policy limits, and provider argument construction. Live provider qualification stays separate from fixture tests.
