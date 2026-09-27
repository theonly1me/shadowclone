# Stable profile records

This defines the legacy profile lifecycle. Active environments now publish [skills](023-skills-as-delivery.md), while migration still needs to interpret these records.

## Problem

Content-derived identities changed whenever a rule was reworded. Learning could duplicate an edited rule or restore one the user had deleted. Confidence values also mixed evidence strength with whether guidance should be delivered.

## Decision

Give generated rules a stable key independent of their wording. Store source, evidence, scope, conditions, and lifecycle state explicitly. Compilation consumes the lifecycle decision instead of inferring activation from confidence.

Maintain a ledger of the last generated text. Comparing that text with the current file distinguishes an untouched rule, a user edit, and a deletion. Preserve edited rules as user-owned guidance. Retain rejection or retirement records so a later learning pass cannot silently recreate deleted guidance.

Keep a published rule active while contradictory evidence is reviewed. A proposal is separate from the user's current instruction. Historical activation thresholds were later refined by [automatic preference learning](015-automatic-preference-learning.md): explicit durable steering can qualify from one session; inferred behavior needs independent support.

## Compatibility and verification

Import older profile formats without discarding manual text. Malformed or ambiguous files must block destructive rewriting. Check stable identity across wording changes, repeated imports, edits, deletions, rejected proposals, and compilation of active guidance. A migration must preserve both the visible text and the user's decisions about it.
