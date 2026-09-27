# Skills as the learning delivery format

## Problem

An aggregated profile compresses every preference into one startup budget. Copying fragments from that profile into existing skills loses detail and cannot create a missing workflow. Maintaining both representations also obscures which instruction the agent used.

## Decision

Keep complete guidance, evidence, scope, rejections, source hashes, and publication destinations in versioned local learning records. Deliver behavior through portable skills and small native instruction sections. Active skill environments receive no aggregated profile overlay.

Review the entire consented library. Update relevant procedures and descriptions, or create an instruction-only skill when no existing workflow fits. Preserve unrelated text, supporting resources, permissions, and invocation settings. Supported changes to authorized user skills can apply automatically; conflicts and uncertain technical claims remain pending. Third-party packages receive local companions.

A mandatory baseline carries universal guidance. Native sections load it and route tasks to applicable skills; necessary standalone facts remain scoped native context. Both baseline and native sections have separate 4 KiB limits. Overflow is visible and never silently truncates evidence.

Keep global, remote-owner, and repository scopes distinct. Publish repository skills only to registered matching repositories. Skill files, native sections, and publication records form one reversible revision. Pending publication survives a completed capture batch.

## Memory and migration

Read consented Claude memory for registered repositories and use source hashes to avoid repeat processing. Native memory remains read-only. Temporary task state does not become durable guidance.

Migration previews by default. Before switching delivery, freeze the original library and instructions, map active profile entries and references, record unresolved scopes, validate coverage, and publish successfully. Retain legacy profiles for recovery. Source consent alone does not authorize skill writes.

Context diagnostics, hooks, MCP, dispatch, optional subagents, and repository setup use the shared skills delivery path. Historical evaluators retain their original profile semantics. The new skills protocol compares Bare, original Skills, original Skills + Memory, and maintained Skills + native routing.

## Tradeoffs

Skill selection becomes part of correctness and needs separate delivery checks for each provider. Updating coherent workflows avoids creating one overlapping skill per correction. Automatic publication requires evidence, fingerprints, and reversible revisions; unresolved scopes can remain pending.

Private learning records and evaluation evidence stay outside the public checkout. Bundling must also avoid embedding build-machine paths: bind bundled TypeScript paths at runtime and verify the relocated package can still parse TypeScript.

## Verification

Cover updates and creation, baseline routing, memory idempotency, scope, consent, redaction, resource preservation, symlinks, conflicts, interrupted publication, and undo. Keep original and maintained evaluation libraries distinct. Native delivery probes use synthetic sessions; successful migration alone is not evidence of better agent behavior.

Validate focused test paths and existing runtime directories before checking execution support. Unsafe links fail on every platform. A valid snapshot remains unverified on unsupported platforms, without creating a runtime directory or launching a process.
