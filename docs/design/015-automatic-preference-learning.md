# Automatic preference learning

## Problem

Manual learning commands left guidance stale between sessions. Automatic learning needed to distinguish durable instructions from a one-off task request and preserve a clear consent boundary.

## Decision

Treat explicit durable user steering as eligible evidence after one session. Inferred patterns require support from three independent sessions. Interruptions and corrections are interpreted in conversation context, including the next user message; an interruption alone is not evidence of dissatisfaction.

Separate capture consent, model-learning consent, and automatic publication authority. Session hooks can schedule bounded background work only after the relevant opt-ins. [Useful-session attribution](017-self-improving-agent-environment.md) later narrowed this to sessions the main agent marks as containing reusable guidance.

Use session identities and content hashes to avoid repeatedly processing unchanged evidence. Share invocation, time, and supported cost limits across the run. Checkpoint completed work and expose pending changes when publication cannot finish.

Keep user edits and explicit choices authoritative. Record revisions so learned changes can be explained and undone. `remember` records direct user guidance with an explicit scope; it does not justify unrelated global promotion.

Escape both `-->` and `--!>` when storing explicit preferences, alongside comment openings, so comment delimiters remain literal guidance. Cover both forms through preference publication.

## Verification

Exercise durable instructions, temporary requests, independent-session thresholds, repeated hooks, cancellation, and revoked consent. Check that history and undo preserve unrelated edits and that failed background work cannot replace active guidance with incomplete output.
