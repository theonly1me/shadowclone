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

## Pi integration

Pi remains the user's coding harness. Shadowclone installs portable skills, small native routing sections, and an owned lifecycle extension. Pi owns provider configuration, credentials, model selection, tools, and interactive sessions. Shadowclone does not add an agent loop or a model account.

The integration reads Pi sessions only with a separate `pi` source consent, disabled by default. It keeps message ancestry and file cursors, materializes eligible user and assistant text through `resolveRedacted`, and excludes thinking, tools, system messages, injected messages, and generated summaries. Original sessions remain in Pi's storage.

The extension exposes bounded model requests through Pi's provider-neutral model API with an empty tool set. Session-triggered learning uses a private authenticated socket to the live extension, retaining providers registered only in that session. Standalone maintenance invokes the installed Pi CLI with a command extension in an empty temporary directory. Both paths normalize responses into the existing engine contract. A session-triggered learning worker retains the originating harness and model; explicit options precede those selections, followed by saved distillation preferences and existing engine detection. Configuration stores harness and model references, without endpoints or credentials.

Implementation proceeds through registry and configuration, owned guidance and extension delivery, capture and redaction, model execution and selection, onboarding and diagnostics, then synthetic and installed-harness qualification. Existing publication ownership, policy, cancellation, output bounds, and call/time limits apply throughout. Dispatch and evaluation remain unavailable until Pi meets their enforceable isolation and action-policy contracts.

Shared skill ownership must survive a partial refresh. If one harness refreshes the shared skill while another preserves an edited extension, their recorded skill fingerprints can differ. Removing the harness with the current fingerprint transfers that verified ownership to surviving harnesses before its manifest entry disappears. Transfer applies only when the current file matches the departing owner's fingerprint; intervening manual edits remain protected. Uninstall resolves the current manifest entry by installation id so a batch removal consumes ownership transferred by an earlier step. A regression test exercises the partial refresh, both uninstall steps with an earlier manifest snapshot, and final shared-file cleanup.

Applying managed policy preserves the saved harness and model references while narrowing execution permission. Dropping those references would let background maintenance, diagnostics, migration, and browser generation ignore the user's selection. A blocked selection remains explicit and fails at the execution boundary; it does not become an implicit fallback. Regression coverage includes Pi and the existing learning harnesses.

Browser generation previews identify the selected model and retain that selection for the reviewed request. Cached generation results are keyed by harness, model, and prepared input so switching models cannot reuse a response from a different model. Existing harness-default behavior remains available when no model is selected.

### Qualification results

The installed-harness checks used Pi 1.0.0 and synthetic material. Pi's existing coding loop wrote a requested function through Ollama. Its command bridge completed a prepared, tool-free model call with an exact provider/model selection. A subsequent Pi session loaded published native routing and discovered the shared skill after publication with valid synthetic learning responses.

The complete Pi/Ollama learning cycle remains unqualified with the tested local models. `llama3.2:latest` produced invalid learning JSON or schema results, which were rejected. `deepseek-r1:8b` exceeded the bounded learning deadline and was cancelled. These outcomes establish rejection and cancellation behavior, not successful preference extraction with those models. Synthetic contracts cover successful learning publication, lifecycle deduplication, provider extensions, ancestry, redaction, and reversible installation. Dispatch and evaluation remain disabled.
