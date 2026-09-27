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

Choosing coverage in proportion to a change's possible consequences.

## Process

1. Identify affected behavior and callers. Rank risks by consequence, likelihood, and existing coverage.
2. Read nearby tests for the established public interface and fixture style.
3. Cover material gaps with the smallest fixture that crosses the real failure boundary.
4. Run focused tests and the repository checks covering affected consumers.
5. Define any necessary manual check with its setup, action, and expected result, then report what remains unverified.

## Guardrails

Prioritize state changes, permissions, persistence, parsing, routing, and public contracts. Reuse existing coverage when it already detects the regression.

Skip tests that mirror private branches or assert reversible text and styling changes unless those details are a supported contract. Keep expected results independent of production calculations and avoid redundant cases for the same risk.

## Completion

Each material risk has a meaningful automated or manual check, selected checks have run, and remaining uncertainty is explicit.
