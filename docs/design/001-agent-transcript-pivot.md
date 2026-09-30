# Learning from agent transcripts

This introduced transcript learning and authenticated agent CLIs. [Skills delivery](023-skills-as-delivery.md) later replaced the profile as the main output.

## Problem

Shell history records commands but rarely explains why a user rejected an approach or asked for a different workflow. Corrections in coding-agent conversations provide more direct evidence. Requiring a separate model API key also added setup for users who already had an authenticated agent CLI.

## Decision

Learn from consented sessions through a pipeline of observation, indexing, signal derivation, and semantic learning. Send model requests through the engine boundary using an authenticated CLI and its provider limits.

Events carry `TextRef` locators. The index stores event metadata and incremental cursors without transcript bodies. `resolveRedacted` materializes eligible excerpts and applies redaction. Tool results, file-operation contents, thinking blocks, and data-access results are excluded from learning.

Keep derived guidance in editable local files with provenance. Preserve user edits and rejections. Repository and remote-owner scope prevent guidance from spreading to unrelated projects; global guidance requires explicit global evidence or a direct user decision. Git metadata has its own consent.

The original output was a Markdown profile delivered to a Claude subagent. [Native main-agent delivery](017-self-improving-agent-environment.md) and skills delivery extended this without removing the consent or scope boundaries.

## Consequences

Locators can become unreadable when transcripts change or disappear. Resolution must fail without substituting unrelated text. Incremental adapters must handle truncation and incomplete trailing records.

Authenticated CLIs avoid another credential setup, but inference still sends context to a provider and is subject to its usage limits. Redaction reduces exposure without guaranteeing anonymity. Provider capabilities must be qualified separately.

## Verification

Use synthetic adapter fixtures to exercise source records through the redaction boundary, including excluded fields and planted secrets. Check incremental ingestion, scope isolation, managed-policy limits, and provider argument construction. Live provider qualification remains separate from fixture tests.
