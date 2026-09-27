# Repairing incremental learning

## Problem

Older profiles could be dropped during parsing, targeted learning could select old sessions instead of the requested one, and a moving time window could permanently skip unprocessed history.

## Decision

Migrate recognized legacy records while preserving manual text and lifecycle decisions. Reject malformed or ambiguous files before any destructive write. An empty parse is not permission to replace an existing profile.

When a session is requested, select that session's newest eligible evidence. Background catch-up walks the unprocessed history through a durable ledger instead of repeatedly sampling a recent window. Source hashes distinguish new material from already processed content.

Checkpoint bounded batches and resume from completed work. Publication failure must remain visible and recoverable. [Skills delivery](023-skills-as-delivery.md) later made pending publication independent of capture completion, so a finished capture batch cannot hide unpublished guidance.

## Verification

Cover legacy and malformed profiles, the requested session among many older sessions, repeated catch-up, deleted or truncated sources, budget exhaustion, and interruption between learning and publication. Preserve user edits and rejected records throughout recovery.
