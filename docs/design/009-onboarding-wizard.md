# Onboarding choices

This was the original terminal onboarding design. [Launch readiness](019-launch-readiness.md) simplified initial setup, and [agent builds](024-agent-builds.md) made the browser wizard the default for choosing skills.

## Problem

Consent questions without context made setup difficult to follow. Users also needed a way to declare preferences before enough session evidence existed to learn them.

## Decision

Present available guidance and relevant source choices in a guided setup. Discover source availability through the pre-consent boolean check, then read only sources the user enables. Absent providers should not create unnecessary questions.

Preview the selected guidance and installation targets before applying changes. Cancellation must leave configuration, guidance, and integrations unchanged. Repeating setup must reuse stable identities and preserve user edits instead of adding duplicate rules.

Keep declared choices separate from inferred preferences. Selecting a workflow expresses a direct user decision; background learning requires its own consent.

## Verification

Exercise cancellation at every prompt, an empty machine, existing installations, conflicting choices, and repeated application. Confirm that preview does not write or read unconsented source contents. Both terminal and browser interfaces must use the same underlying configuration and publication rules.
