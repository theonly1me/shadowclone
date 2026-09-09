---
name: verify-and-review
description: Verify changed behavior and inspect the final diff before presenting completed work. Use when an implementation, fix, refactor, or documentation change is ready for handoff.
metadata:
  shadowclone-category: review
  shadowclone-section: workflow
  shadowclone-applies-when: preparing completed work for review or handoff
---
# Verify and Review Before Finishing

## Use when

Use this skill after implementation is complete and before claiming the work is ready. Verification must support the claims in the handoff, while review checks that the diff says one coherent thing.

## Process

1. List the changed behaviors, data paths, public interfaces, and documentation claims.
2. Discover the repository's own checks from scripts, contributor guidance, and continuous integration configuration.
3. Run the narrow checks that exercise each changed behavior while failures are cheap to diagnose.
4. Run the required repository gate once the focused checks pass.
5. Inspect the final diff with surrounding code, including new files that an ordinary diff may omit.
6. Trace values entering logs, errors, file writes, and network calls to their source and required redaction boundary.
7. Compare public documentation and architecture diagrams with the implemented behavior.
8. Check the working tree for generated files, debug artifacts, secrets, and unrelated edits.
9. Report the exact commands run, their results, and any behavior that still depends on manual or external verification.

## Guardrails

- Match each completion claim to evidence from a check or direct inspection.
- Distinguish a failing pre-existing check from one caused by the change and provide evidence for that distinction.
- Re-run a broad gate only after a later edit can affect its result.
- Inspect indentation, scope, and neighboring declarations rather than relying only on compilation.
- Keep captured user content out of logs and review text unless it has passed the required redaction boundary.
- Do not present a build artifact as proof of runtime behavior when the changed path was never exercised.
- Preserve material limitations in the handoff so a reviewer knows what remains uncertain.

For user interfaces, exercise the changed state and inspect the rendered result at the supported viewport or terminal. For data handling, name every sink and show where raw content becomes safe.

## Completion

Verification is complete when every changed behavior has evidence, the required repository gate passes, the final diff and working tree are clean, public claims match the code, sink tracing is accounted for, and remaining manual or external checks are stated plainly.
