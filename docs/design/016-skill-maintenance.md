# Maintaining existing skills

This introduced profile-backed skill amendments. [Skills delivery](023-skills-as-delivery.md) later allowed complete workflow updates and creation without an aggregated profile.

## Problem

Newly learned preferences did not improve the skills an agent already used. Copying every profile rule into every skill would create duplication and erase the purpose of each workflow.

## Decision

Review the selected agent's entire consented library, including installed third-party skills. Match supported guidance to relevant workflows and propose exact passage changes. Keep unrelated instructions, supporting resources, permissions, and invocation settings intact.

Separate permission to read a library from permission to edit it. User-authored skills need explicit write authorization. Provider-owned packages remain unchanged; personal amendments belong in local companions. Conflicting manual edits require review.

Inspect resource structure without treating arbitrary resource contents as learning input. Use bounded model execution shared with the learning run. Review routing as well as body text so an updated skill remains discoverable for the intended task.

Publish revisions with fingerprints and backups. An intervening edit blocks replacement. Report skipped and pending work so a successful review is not mistaken for complete publication.

## Verification

Exercise whole-library review, relevant and irrelevant matches, resource preservation, package companions, consent, conflicts, interrupted publication, and undo. See [the maintenance guide](../guides/skills.md) for current commands and permissions.
