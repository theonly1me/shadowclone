---
name: testing-first
description: Build observable behavior through a red-green cycle at a stable public seam. Use when the user asks for test-first work, TDD, or a regression test before implementation.
metadata:
  shadowclone-category: testing
  shadowclone-section: engineering
  shadowclone-applies-when: changing observable behavior with a test-first workflow
  shadowclone-axis: testing-approach
---
# Test First Through a Public Seam

## Use when

Use this skill when a behavior can be exercised through an interface that callers already use, or through the interface the change is intended to create.

Before writing a test, identify the observable result and the seam where a real caller sees it. If the seam is unclear, settle the interface before committing to test structure.

## Process

1. State one behavior as concrete input and observable output. Name the user-visible failure the test must detect.
2. Find the narrowest stable seam that reaches the behavior without exposing private implementation details.
3. Write one test through that seam with an expected value independent of the implementation.
4. Run only that test and confirm it fails because the behavior is absent or wrong.
5. Implement the smallest vertical slice that makes the test pass. Include every layer required for that one behavior.
6. Run the focused test again. Inspect the failure if it stays red rather than weakening the assertion.
7. Repeat with the next behavior only after the previous slice is green.
8. Run the broader checks affected by the completed slices and review the final diff for speculative code.

## Guardrails

- Test behavior through the same interface a caller uses.
- Keep each cycle to one new claim. Multiple assertions may support that claim when they observe one outcome.
- Use literals, specifications, recorded fixtures, or another independent source for expected results.
- Prefer real collaborators inside the tested module. Replace a dependency only at an established external seam.
- Keep the failing output long enough to prove the test can detect the missing behavior.
- Remove implementation added for a future test that has not been written.

A test is coupled to implementation when a harmless refactor breaks it while public behavior stays the same. Move that test outward to the stable seam.

A test is tautological when it recreates the production calculation to derive the expected value. Replace the derived expectation with a result obtained independently.

## Completion

The work is complete when every requested behavior has a focused test that was observed failing first, the implementation passes those tests through public seams, affected repository checks pass, and the diff contains no code justified only by an unwritten future test.
