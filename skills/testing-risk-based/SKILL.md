---
name: testing-risk-based
description: Select tests from concrete regression risk instead of applying test-first work to every edit. Use for changes where the user wants proportional coverage or where existing behavior may regress.
metadata:
  shadowclone-category: testing
  shadowclone-section: engineering
  shadowclone-applies-when: changing observable behavior with proportional test coverage
  shadowclone-axis: testing-approach
---
# Test Where Behavior Is at Risk

## Use when

Use this skill when the change should be tested in proportion to what can break. It fits maintenance work, extensions to tested modules, and changes where a presentation-only edit has a different risk than a state transition or data boundary.

## Process

1. List the observable behaviors touched by the change and the callers that depend on each one.
2. Rank the risks by consequence, likelihood, and whether an existing check would detect the regression.
3. Read nearby tests to find the established public seam and fixture style.
4. Add or change a test for every material risk that existing coverage misses.
5. Use the smallest fixture that still crosses the real boundary where the regression could occur.
6. Run the focused tests, then the repository checks that cover affected consumers.
7. Inspect the final diff and explain any material risk left to manual verification.

## Guardrails

- Add coverage for changes to state, permissions, persistence, parsing, routing, and public contracts.
- Prefer an existing integration seam when a unit test would only mirror private branches.
- Skip a new test when an existing test already fails under the proposed regression and clearly names the behavior.
- Skip tests that assert static text, styling, or reversible wiring unless those details are a supported contract.
- Keep expected results independent from the code that computes them.
- Do not inflate test count with cases that exercise the same branch and consequence.

When the risk cannot be automated, define a manual check with exact setup, action, and expected result. A vague instruction to test manually is not coverage.

## Completion

The work is complete when every material regression risk is caught by an existing test, a new test, or a concrete manual check; all selected checks have run; and the handoff states any remaining unverified behavior.
