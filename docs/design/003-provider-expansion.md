# Qualifying provider support

## Problem

A provider may expose readable sessions without supporting isolated model calls or controlled actions. A single “supported” label hides those differences.

## Decision

Track observation, distillation, dispatch, and native integration independently in the provider registry. Declare a capability only when its adapter implements the required controls and qualification has exercised them.

Learning requires authenticated execution with tools and ambient context disabled, bounded input and output, cancellation, and structured results. Dispatch additionally requires enforceable tool restrictions, repository isolation, and the action-policy controls used by the caller. Unsupported combinations fail before execution.

Keep provider-specific argument construction and output parsing behind `src/engine/`. Shared callers check declared capabilities. Tests must distinguish a provider's advertised feature from a control Shadowclone can enforce.

## Antigravity boundary

Session capture and native guidance do not qualify an inference engine. The available logging and cancellation surfaces did not establish an enforceable tool-free execution mode. Antigravity therefore remains a capture and native-integration provider until that boundary can be demonstrated.

## Verification

Use synthetic fixtures for parsing, timeouts, cancellation, model selection, and argument construction. A live probe must verify the installed provider's actual behavior before widening support. Record limitations in the [engine architecture](../architecture/03-engine.md), which describes current capabilities.
