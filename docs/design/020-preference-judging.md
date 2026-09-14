# Preference judging and interrupted-run recovery

## Summary

Freeze source-backed coding preferences before execution, grade three matched arms independently, and save validated vote batches as they finish. Separate an evaluation's completion from any measured profile improvement. The current contracts are in [the evaluation architecture](../architecture/09-evaluation.md); the [early public report](../../evals.md) records results and limitations.

## Problem

Model-selected preference summaries could omit hard rules or weaken their meaning. Expanding entire instruction documents into checks introduced workflow instructions and explanatory material that could not be judged from code. Both approaches distorted the measurement.

Judging also kept completed votes only in memory. Later failures could lose finished work, a recorded judging failure could block resume, and an outer deadline could leave stale running state. None of these conditions should be mistaken for a low preference score.

## Design

The three arms are repository-only Bare, repository plus frozen personal context Skills, and those same inputs plus the compiled profile Clone. Native Shadowclone additions are removed from all repository snapshots. Existing authored repository guidance remains available to all arms.

`compileCodeRubric` selects verbatim rule quotations through a fixed catalog of supported coding categories. Each criterion carries a stable ID, source location, fingerprint, scope, and task-override contract. It excludes workflow prose and duplicate categories. This catalog does not interpret arbitrary new preferences automatically.

Rubric version 2 includes the explicit naming clarification: PascalCase language conventions and human-readable prose are valid; freely chosen value identifiers and symbolic string identifiers retain their applicable casing rules.

Three independent votes grade each criterion for each anonymous candidate. Correctness is requested separately. Preference batches contain at most eight criteria, and every remaining criterion gets another batch. Structured responses must contain exactly the expected IDs and bounded evidence. A malformed response can retry twice after its first attempt.

Receipt schema 12 stores completed batches, pending work, bounded redacted attempt diagnostics, and stage-specific failures. Each validated batch is checkpointed immediately. Resume validates the frozen work, preserves completed votes, and retries missing judging without rerunning code whose evidence was saved.

A serialized receipt recorder saves terminal deadline or error state at the outer boundary. Late inner responses cannot overwrite terminal state. Unsupported historical receipts are preserved, not silently migrated. A rubric change creates a new evaluation identity.

Reports show missing scores as ungraded and separate evaluation completion from profile improvement. A tie or loss is a valid complete result. Correctness and safety regressions remain separate from preference adherence.

## Data handling

Captured guidance is resolved through the existing redaction boundary before entering frozen context. Evaluation is separately authorized to expose the selected repository snapshot to the coding provider. Generated code evidence is not redacted before judging, so private receipts and snapshots are not publication artifacts. Judge explanations and failure diagnostics are redacted and bounded.

Public reports summarize the methods, scores, and limitations after review.

## Verification

Regression fixtures cover positional arguments versus options objects, forbidden comments, task-mandated signatures, naming scope, malformed responses, interruption after saved votes, resume without coding reruns, outer deadline expiry, and incomplete-result reporting.

Live validation used a pilot followed by three additional tasks across all arms. The pilot's saved code was regraded under the naming clarification without replacing its historical receipt. Every final preference criterion has three saved votes. The report still flags inconsistent test-setup grading and an unsupported correctness requirement; completed execution does not mean every judgment is valid.

## Accepted limits

Model votes can share errors, a fixed catalog covers only recognized rules, and code-only review does not execute the complete test suite. The early sample is small and has no repeated implementations per task. Broader evidence and more precise judging fixtures are needed before stronger claims.

## Decision record

Keep the rubric source-backed because personal preference must not become generic code quality.

Checkpoint every validated batch because a later failure must not discard completed judging.

Preserve historical receipts because changing a rule is a new measurement, not a reason to rewrite a score.

Report completion and improvement separately because the evaluator must be allowed to show a tie or a loss.
