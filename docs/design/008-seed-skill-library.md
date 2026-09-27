# Bundled preferences and skills

## Problem

A short preference and a task workflow serve different purposes. Treating every preference as a skill creates thin, repetitive files; putting complete workflows in a profile makes startup guidance too large.

## Decision

Ship two package-owned libraries that work without model calls:

- Eight preferences across four mutually exclusive axes, each expressing a concise choice.
- Ten task skills, including two alternative testing workflows and eight independent workflows.

Preferences use stable identifiers and axis membership so a declared choice can replace its sibling. Skills contain enough instruction to perform a task and remain readable as ordinary files. The library avoids imposing this repository's own comment policy on every user.

Validate metadata and reject unknown frontmatter fields. Each skill must have exactly one non-empty `Use when`, `Process`, `Guardrails`, and `Completion` section. Keep identifiers independent of display names so edits to prose do not change installed identity.

## Consequences

Bundled guidance is a starting point. Users can select, edit, or replace it. Packaging owns the seed files; installed user copies need ownership and conflict checks before updates.

## Verification

Parse every packaged preference and skill through the production loader. Check duplicate identities, conflicting axes, malformed metadata, missing or repeated sections, and package inclusion. [Agent builds](024-agent-builds.md) adds a visual way to select this library alongside user-created skills.
