# Related approaches

Shadowclone sits alongside instruction files, personal skills, agent memory, and tools that inspect coding sessions. This page describes the design choices that matter to the project. It is not an exhaustive market survey or a claim that other tools cannot provide similar features.

## Different jobs

| Approach | What it provides | What to check |
| --- | --- | --- |
| Repository instructions | Explicit conventions checked into a project | Whether the instructions are current and which agents load them |
| Personal skills | Reusable workflows and references selected for a task | Ownership, routing, freshness, and conflicting copies |
| Agent memory | Context retained between sessions | Scope, editability, retention, and how new evidence changes old guidance |
| Transcript analysis | A view of earlier interactions | Consent, eligible content, redaction, and whether observations justify a rule |
| Preference checks | Evidence that output followed stated guidance | Rubric fidelity, task exceptions, judge error, and missing results |

These approaches can complement one another. Well-maintained instructions may already express what a user needs. Adding learned guidance can help, have no effect, or introduce conflicting context.

## Shadowclone's choices

Shadowclone reads existing sessions only from enabled sources. It assesses reusable user steering and keeps the resulting guidance in editable Markdown. It can start from existing history; a user does not need to wait for a new corpus to accumulate after installation.

One compiler selects global, matching remote-owner, and exact-repository guidance for supported native integrations and delegated runs. Remote-owner scoping is a technical boundary, not proof of a legal organization or employer boundary.

Personal skills remain separate from profile rules. Shadowclone synchronizes consented copies, preserves user edits, and leaves technical or routing changes for review. The profile does not replace the original skill's procedure.

Model calls use an installed authenticated CLI. That avoids a separate Shadowclone account or hosted service, but still consumes provider quota and requires permission to send the selected input to that provider. Local storage is not the same as offline inference.

## What has been measured

The [early four-task evaluation](../../evals.md) compares repository-only guidance, existing personal skills/context, and that context plus the Shadowclone profile. It measures source-backed coding preferences and reports correctness separately. The sample and judging limitations prevent broad claims about productivity or superiority over other products.

Native hook delivery, skill synchronization, and learning quality need their own validation. A successful profile-injection check proves delivery, not that the model obeyed it. A coding-preference score does not prove that the profile learned every preference correctly.

## Open questions

The useful comparisons are against current, well-maintained user guidance across more tasks and model configurations. It also matters whether keeping the profile accurate costs less effort than maintaining instructions directly. The project does not yet have evidence that settles those questions.
