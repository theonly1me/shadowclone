---
name: design-deep-modules
description: Design or improve a module so callers get substantial behavior through a small stable interface. Use when choosing seams, reducing orchestration in callers, or making a subsystem easier to test and change.
metadata:
  shadowclone-category: architecture
  shadowclone-section: engineering
  shadowclone-applies-when: designing or reshaping a module or subsystem
---
# Design Deep Modules

## Use when

Use this skill when complexity is spread across callers, a proposed abstraction mostly forwards arguments, or tests must reach through several layers to observe behavior.

A module is any implementation presented through an interface. Depth means the caller learns a small interface and receives substantial coherent behavior. A seam is the place where one implementation can be replaced without editing its callers.

## Process

1. List the callers and the facts each caller currently needs to coordinate the behavior.
2. Separate policy decisions from mechanical steps and identify the implementation that owns the required state.
3. Write the smallest interface that lets callers express their intent without coordinating internal order.
4. Sketch at least two materially different placements for the seam when its location is uncertain.
5. Compare the alternatives by caller burden, hidden complexity, error behavior, and the tests each interface enables.
6. Choose the interface that keeps related policy and state local while preserving useful variation.
7. Move orchestration behind the interface and remove pass-through layers that add no decision or isolation.
8. Test behavior through the chosen interface with dependencies replaced only at real external seams.
9. Read every caller again and remove knowledge that now belongs inside the module.

## Guardrails

- Add a seam when behavior or dependencies genuinely vary, or when isolation is required at an external boundary.
- Keep invariants, ordering, error modes, and configuration inside the interface contract.
- Prefer one options object over sequences of primitive arguments that callers must correlate.
- Return results when callers need outcomes; contain side effects behind the owning interface.
- Avoid wrappers whose public surface repeats the implementation beneath them.
- Keep repository and domain terms in names so the interface matches the system users recognize.

An interface is still large when callers must know which methods to call, in what order, and which intermediate state to carry. Move that sequence behind one intent-level operation.

## Completion

The design is complete when callers express intent through a smaller interface, related complexity has one owner, each remaining seam has a concrete reason to vary or isolate, and tests can exercise the module without depending on its internal sequence.
