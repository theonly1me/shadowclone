---
name: diagnose-before-editing
description: Diagnose a reproducible defect or performance regression before changing production code. Use when behavior is broken, failing, throwing, flaky, or unexpectedly slow.
metadata:
  shadowclone-category: debugging
  shadowclone-section: workflow
  shadowclone-applies-when: diagnosing a reported defect or performance regression
---
# Diagnose Before Editing

## Use when

A defect or performance regression has no demonstrated cause yet.

## Process

1. State the input, actual result, and expected result. Find the fastest repeatable command that reaches the failing path.
2. Reproduce the reported failure, then remove inputs or steps while preserving it.
3. Trace where correct state first becomes incorrect. List plausible causes and an observation that would disprove each.
4. Probe one cause at a time with a debugger, targeted instrumentation, timings, or controlled inputs.
5. Stop when a cause predicts the symptom and a controlled change removes it.
6. Preserve the reproduction as a regression test through a stable public interface where practical. Fix the cause at its origin.
7. Run the reduced and original reproductions, then remove temporary diagnostics.

For flaky behavior, measure the reproduction rate and control clocks, randomness, concurrency, or external responses. For performance work, establish a baseline and measure the suspected cost before changing it.

## Guardrails

Redact sensitive traces and paths before reporting them. Change one causal variable per probe. Keep unrelated defects out of the fix and avoid fallbacks that merely hide invalid state.

If reproduction fails, report what was tried and the missing evidence. Do not turn an unverified theory into a production change.

## Completion

The cause explains the original symptom, the fix passes both reproductions and affected checks, and temporary instrumentation is gone.

Report the reproduction command with its failing line before the fix and its passing line after, the cause in one sentence with the file and line where state first goes wrong, and anything you could not reproduce. Keep the reply to these facts. When a pull request exists, put full command output in its verification section instead of the reply.
