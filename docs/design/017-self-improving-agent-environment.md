# A portable agent environment

## Problem

Copied profile text became stale, automatic learning could process unhelpful sessions, and personal skills diverged across coding agents. Historical replay also mixed imitation with useful preference adherence.

## Decision

Use stable native pointers and session hooks to load current scoped guidance. The main agent marks a useful session through an opaque, expiring attribution token; session-end work then processes that session within the user's learning permissions. A model may classify evidence but cannot widen capture consent.

Maintain canonical personal skills and portable copies. Preserve divergent manual edits and package ownership. Global publication contains only global guidance; repository and remote-owner learning retain their scopes.

Keep explicit durable steering eligible after one session and inferred patterns dependent on independent support. Persist evidence and revisions so a user can inspect and reverse learning.

## Verification

Check session attribution, expiry, revoked consent, hook preservation, scope, skill synchronization, and undo. Evaluate native discovery separately from behavioral effects: supplying frozen context explicitly does not prove a provider's native loader works.
