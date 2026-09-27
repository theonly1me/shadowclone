# Reconciling learned preferences

This introduced reconciliation for profiles. The same evidence and user-authority constraints inform current [skill maintenance](023-skills-as-delivery.md).

## Problem

Regenerating guidance from each batch could duplicate existing rules, reverse explicit choices, and lose rejections. A model-generated confidence score did not establish enough evidence to publish a change.

## Decision

Give the learner the existing guidance, relevant evidence, and prior user decisions. Return typed proposals to retain, add, revise, contradict, or retire guidance. Evidence tokens must refer to excerpts supplied in that request; the model cannot invent source identities.

Use named preference axes to propose a concrete sibling when a choice changes. Keep free-form guidance where no axis applies. Preserve declared, imported, and manually edited instructions while contradictory evidence awaits review.

Separate activation from confidence. The original design required three independent sessions for mined guidance; [automatic preference learning](015-automatic-preference-learning.md) later allowed explicit durable user instructions from one session while retaining the stronger requirement for inferred behavior.

Bind checkpoints to the redacted prompt, output schema, and learner version. Read metadata and model-facing text from one bounded snapshot so reconciliation cannot pair a stale hash with different contents. Preview the proposed changes unless the caller has explicitly authorized application.

## Verification

Exercise repeated evidence, invalid evidence tokens, axis conflicts, user edits, rejected proposals, and stale checkpoints. Test that model failures preserve published guidance. Mutation checks must prove the source-to-redaction wiring, including instruction titles and conditions that could also contain secrets.
