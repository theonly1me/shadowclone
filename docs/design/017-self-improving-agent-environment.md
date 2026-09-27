# A portable agent environment

## Problem

Copied profile text became stale, automatic learning could process unhelpful sessions, and personal skills diverged across coding agents. Historical replay also mixed imitation with useful preference adherence.

## Decision

Use stable native pointers and session hooks to load current scoped guidance. The main agent marks a useful session through an opaque, expiring attribution token; session-end work then processes that session within the user's learning permissions. A model may classify evidence but cannot widen capture consent.

Maintain canonical personal skills and portable copies. Preserve divergent manual edits and package ownership. Global publication contains only global guidance; repository and remote-owner learning retain their scopes.

Keep explicit durable steering eligible after one session and inferred patterns dependent on independent support. Persist evidence and revisions so a user can inspect and reverse learning.

## Evaluation change

Compare fresh tasks on the same committed repository state in three conditions: repository guidance, added personal context, and that context plus a compiled profile. Freeze tasks, inputs, and criteria before execution. Save evidence and judge results so interrupted grading can resume without regenerating candidates.

Completion depends on every expected result being present, not on the profile winning. A tie or loss is a valid completed comparison. [Preference judging](020-preference-judging.md) refined this protocol; [skills delivery](023-skills-as-delivery.md) introduced a separate comparison for maintained libraries.

## Verification

Check session attribution, expiry, revoked consent, hook preservation, scope, skill synchronization, and undo. Evaluate native discovery separately from behavioral effects: supplying frozen context explicitly does not prove a provider's native loader works.
