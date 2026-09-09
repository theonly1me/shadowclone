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

Use this skill for a reported defect whose cause is not already demonstrated by a failing test or a direct invariant violation. The goal is a tight feedback loop and a causal explanation before the production fix begins.

## Process

1. Restate the symptom as concrete input, actual output, and expected output.
2. Build the fastest repeatable command that reaches the same path and produces a binary result for that symptom.
3. Run the command and verify it fails in the way the user described.
4. Reduce the scenario one input, dependency, or step at a time while preserving the failure.
5. Trace data and control flow across the remaining boundaries. Record where correct state first becomes incorrect.
6. Form several falsifiable causes and rank them by evidence. For each cause, state what observation would disprove it.
7. Probe one cause at a time with a debugger, targeted instrumentation, a query plan, or a controlled input change.
8. Remove disproved causes. Stop when one cause predicts the observed failure and a controlled change removes it.
9. Turn the reduced reproduction into a regression test at the public seam when that seam can express the defect.
10. Apply the smallest fix at the point where the invalid state originates.
11. Re-run the reduced test and the original reproduction, then remove diagnostic artifacts.

For a flaky defect, measure its reproduction rate and tighten the trigger until the signal is useful. Pin clocks, random seeds, concurrency, and external responses where they influence the outcome.

For a performance regression, establish a baseline measurement before forming a theory. Use profiling, timings, or query plans that separate the suspected cost from unrelated work.

## Guardrails

- Keep captured logs, traces, and payloads out of reports until secrets and personal paths are redacted.
- Instrument only boundaries that distinguish current hypotheses.
- Change one causal variable per probe.
- Treat a nearby error as a separate defect unless it explains the reported symptom.
- Fix the origin of invalid state rather than adding a downstream fallback that hides it.
- Preserve a reduced reproduction as a test only when it exercises the real failure through a stable seam.

If the defect cannot be reproduced, report the exact loops attempted and the missing access or artifact required. Do not convert an unverified theory into a production edit.

## Completion

Diagnosis is complete when one repeatable command demonstrates the original symptom, the causal boundary is identified with evidence, the fix makes both the reduced and original reproductions pass, relevant checks stay green, and temporary instrumentation is gone.
