# Bounded learning execution

## Problem

A learning pass could launch many independent model calls without a shared limit. Provider defaults could also expose tools or ambient instructions unrelated to the selected evidence.

## Decision

Give each learning run one budget for invocations, elapsed time, and provider-supported cost. The default limit is 20 calls and five minutes, with a $2 ceiling where cost is enforceable. Attempted calls count even when they fail. Stop when any limit is exhausted.

Use an explicit run purpose so learning cannot inherit dispatch permissions. Learning has no tools, repository access, ambient instructions, hooks, MCP servers, or implicit memory. The prompt contains only bounded, redacted inputs selected by the caller.

Persist completed work so a later pass can reuse valid checkpoints. Bind reuse to the inputs and learning contract; a checkpoint is not permission to exceed the new run's limits. [Agent builds](024-agent-builds.md) later made shared dollar reservations serial and stopped further calls when cost was unknown.

## Tradeoffs

Some providers cannot report or enforce a dollar limit. Report that limitation and retain invocation and time limits. Provider cancellation and host-process termination need independent enforcement; a timeout wrapper alone does not stop a child process.

## Verification

Exercise shared accounting, failed calls, cancellation, stale checkpoints, and exhausted limits with synthetic providers. Inspect actual provider arguments to ensure tools and ambient discovery are disabled. Setup uses a smaller budget, described in [launch readiness](019-launch-readiness.md).
