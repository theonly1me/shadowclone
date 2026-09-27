# Simpler setup and bounded first learning

## Problem

Initial setup asked too many detailed questions before producing useful guidance. Spawned Claude subagents could miss live context, and setup or evaluation work could outlast a reasonable first run.

## Decision

Use a short default setup covering source access, skill maintenance, and background learning, with detailed source selection available in advanced mode. After consent, allow a first learning pass capped at 12 calls and 90 seconds, with a $1 ceiling where supported.

Deliver scoped context to spawned Claude agents through `SubagentStart` as well as the main-session path. Preserve existing hook configuration and keep session attribution separate from the supplied guidance.

Serialize reconciliation where concurrent writers could lose changes. Evaluate from frozen snapshots so later learning or user edits cannot change a comparison mid-run. Bound task generation, candidate execution, and judging, and preserve recoverable results when a limit is reached.

## Verification

Exercise the default and advanced setup paths, cancellation, first-pass limits, concurrent updates, and main-agent and subagent delivery. Synthetic and live checks establish only the behavior they exercise. Successful setup or a completed evaluation does not establish a productivity gain.

The browser-first skill editor is described in [agent builds](024-agent-builds.md).
