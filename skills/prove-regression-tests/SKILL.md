---
name: prove-regression-tests
description: Prove that a regression test detects the defect it claims to guard by temporarily removing or inverting the enforcing change. Use when adding a test for a confirmed bug or review finding.
metadata:
  shadowclone-category: testing
  shadowclone-section: workflow
  shadowclone-applies-when: adding a regression test for a confirmed defect
---
# Prove Regression Tests

## Use when

Use this skill after a defect has a focused test and a fix. A passing test after the fix does not show that the test reaches the broken behavior, so the enforcing change must be removed or inverted briefly.

## Process

1. Identify the smallest production condition, expression, or value that makes the fixed behavior differ from the defect.
2. Choose a minimal inverse that restores the defect while keeping the code compilable and the test runnable.
3. Apply only that inverse. Avoid reverting the full patch or deleting the implementation under test.
4. Print the mutated lines with file and line numbers so the changed condition is visible.
5. Run the narrow regression test and confirm its assertion fails on the user's original symptom.
6. Reject the test if it passes, fails during setup, or fails for an unrelated reason. Improve the seam or assertion before continuing.
7. Restore the enforcing line exactly.
8. Print the restored lines and run the same test again.
9. Run the affected suite to ensure the proof mutation left no residue.

## Guardrails

- Keep the mutation local, reversible, and valid under the type checker.
- Mutate production behavior rather than weakening the test.
- Preserve a clean working tree outside the lines involved in the proof.
- Avoid destructive history commands to simulate the regression.
- Treat a setup error, compiler error, timeout, or different assertion as a failed proof.
- Restore before changing anything else so later failures cannot inherit the mutation.

When several tests cover the same fix, run the narrowest test first. Broaden only when the claimed protection spans multiple public behaviors.

## Completion

The proof is complete when the visible inverse causes the intended assertion to fail, the visible restoration makes the same test pass, the affected suite passes, and the working diff contains only the intended implementation and test.
