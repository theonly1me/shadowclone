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

Callers coordinate too many steps, an abstraction only forwards arguments, or tests must reach through layers to observe behavior. A deep module provides substantial behavior through a small interface.

## Process

1. Read the callers and identify the state, ordering, and policy they currently coordinate.
2. Put related state and decisions under one owner. Define an operation that expresses the caller's intent.
3. When the boundary is unclear, compare two placements by caller burden, error handling, and testability.
4. Move internal sequencing behind the interface. Remove forwarding layers that provide no useful variation or isolation.
5. Test through the public interface, replacing dependencies only at real external boundaries.
6. Revisit callers and remove knowledge now owned by the module.

## Guardrails

Keep invariants and error behavior in the interface contract. Use an options object when callers would otherwise correlate primitive arguments. Return outcomes callers need, and contain side effects within their owner.

Add an abstraction for a concrete variation or isolation need. A short interface still imposes complexity if callers must know a hidden sequence of calls.

## Completion

Callers express intent without coordinating internal steps, and tests exercise behavior without depending on that sequence.
