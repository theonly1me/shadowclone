# Preference judging and recovery

## Problem

An evaluation could finish coding but lose useful work when judging failed. Unclear criteria also let judges penalize valid code or confuse task completion with preference improvement.

## Decision

Freeze a versioned, source-backed rubric before execution. The legacy transfer rubric recognizes 17 coding-preference categories. Each criterion retains its source quotation, scope, and task-override rule. A task-required public signature overrides a conflicting preference only for that API.

Judge anonymous candidates independently, with three votes per criterion and a majority result. Separate correctness from preferences. Send at most eight preference criteria per request, adding batches until every criterion is covered.

Validate each response against the expected identifiers. Missing, duplicated, unknown, or malformed checks invalidate the response; they are not zero scores. Persist every validated batch immediately. Resume only missing judging work from saved candidate evidence.

Report incomplete work as ungraded. A comparison is complete when every expected candidate and judgment is present, including ties and losses. The repeated-run threshold is a reporting requirement, not proof of statistical significance or judge validity.

## Historical results

Rubric clarification allowed PascalCase type names and human-readable error messages. The pilot was regraded under that version before the remaining tasks ran. Later discovered inconsistencies remain disclosed alongside the original scores in [the evaluation report](../../evals.md); they are not silently corrected.

## Verification

Exercise malformed votes, batch retries, checkpoint recovery, exhausted deadlines, and changed rubric identities. Review known judge disagreements against the source rule. Multiple votes can share a mistake, so retain executable checks and human review where the protocol supports them.
