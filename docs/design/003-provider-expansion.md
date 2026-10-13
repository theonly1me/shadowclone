# Qualifying provider support

## Problem

A provider may expose readable sessions without supporting isolated model calls or controlled actions. A single "supported" label hides those differences.

## Decision

Track observation, distillation, dispatch, and native integration independently in the provider registry. Declare a capability only when its adapter implements the required controls and qualification has exercised them.

Learning requires authenticated execution with tools and ambient context disabled, bounded input and output, cancellation, and structured results. Dispatch additionally requires enforceable tool restrictions, repository isolation, and the action-policy controls used by the caller. Unsupported combinations fail before execution.

Keep provider-specific argument construction and output parsing behind `src/engine/`. Shared callers check declared capabilities. Tests must distinguish a provider's advertised feature from a control shadowclone can enforce.

## Antigravity boundary

Session capture and native guidance do not qualify an inference engine. The available logging and cancellation surfaces did not establish an enforceable tool-free execution mode. Antigravity therefore remains a capture and native-integration provider until shadowclone can demonstrate that boundary.

## Verification

Use synthetic fixtures for parsing, timeouts, cancellation, model selection, and argument construction. Before you widen support, run a live probe that verifies the installed provider's actual behavior. Record limitations in the [engine architecture](../architecture/03-engine.md), which describes current capabilities.

## Pi integration

Pi remains the user's coding harness. shadowclone installs portable skills, small native routing sections, and an owned lifecycle extension. Pi owns provider configuration, credentials, model selection, tools, and interactive sessions. shadowclone does not add an agent loop or a model account.

The integration reads Pi sessions only with a separate `pi` source consent, disabled by default. It keeps message ancestry and file cursors. It reads eligible user and assistant text through `resolveRedacted`. It excludes thinking, tools, system messages, injected messages, and generated summaries. Original sessions remain in Pi's storage.

The extension runs bounded model requests through Pi's provider-neutral model API, with an empty tool set. Session-triggered learning uses a private authenticated socket to the live extension. This keeps providers that only that session registered. Standalone maintenance runs the installed Pi CLI with a command extension in an empty temporary directory. Both paths normalize responses into the existing engine contract.

A session-triggered learning worker keeps the originating harness and model. The order of choice is explicit options, then the originating harness and model, then saved distillation preferences, then existing engine detection. Configuration stores harness and model references. It stores no endpoints or credentials.

The implementation sequence is:

1. Registry and configuration.
2. Owned guidance and extension delivery.
3. Capture and redaction.
4. Model execution and selection.
5. Onboarding and diagnostics.
6. Synthetic and installed-harness qualification.

Existing rules for publication ownership, policy, cancellation, output bounds, and call and time limits apply in every step. Dispatch and evaluation stay unavailable until Pi meets their enforceable isolation and action-policy contracts.

Shared skill ownership must survive a partial refresh. One harness can refresh the shared skill while another keeps an edited extension. Then their recorded skill fingerprints can differ. Removing the harness with the current fingerprint transfers that verified ownership to the surviving harnesses before its manifest entry disappears. The transfer applies only when the current file matches the departing owner's fingerprint. Manual edits in between stay protected. Uninstall finds the current manifest entry by installation id, so a batch removal uses the ownership that an earlier step transferred. A regression test covers the partial refresh, both uninstall steps with an earlier manifest snapshot, and the final shared-file cleanup.

Applying managed policy keeps the saved harness and model references while it narrows execution permission. If it dropped those references, background maintenance, diagnostics, and browser generation would ignore the user's selection. A blocked selection stays explicit and fails at the execution boundary. It does not become an implicit fallback. Regression tests cover Pi and the existing learning harnesses.

Browser generation previews show the selected model and keep that selection for the reviewed request. Cached generation results use the harness, model, and prepared input as the key, so a model switch cannot reuse a response from a different model. The existing harness-default behavior still applies when the user selects no model.

### Qualification results

The installed-harness checks used Pi 1.0.0 and synthetic material. Pi's existing coding loop wrote a requested function through Ollama. Its command bridge completed a prepared, tool-free model call with an exact provider/model selection. A later Pi session loaded the published native routing and found the shared skill after publication. The publication used valid synthetic learning responses.

The complete Pi/Ollama learning cycle remains unqualified with the tested local models. `llama3.2:latest` produced invalid learning JSON or schema results, and shadowclone rejected them. `deepseek-r1:8b` exceeded the bounded learning deadline, and shadowclone cancelled it. These outcomes establish the rejection and cancellation behavior. They do not establish successful preference extraction with those models. Synthetic contracts cover successful learning publication, lifecycle deduplication, provider extensions, ancestry, redaction, and reversible installation. Dispatch and evaluation remain disabled.

## OpenCode integration

OpenCode is a capture and native-integration provider. It is not an inference engine. Shadowclone supports the OpenCode 1.x line (`opencode-ai`) and the 2.x line (`@opencode/cli`). Both lines use the `opencode` program, the same configuration folder, and the same database file.

OpenCode has no run mode that turns off tools, instruction files, and skills together. Version 2.x also has no switch for `.claude` skills. A run therefore cannot meet the learning contract. Session-end learning uses the other engine that the user configured. Add a runner only after a live probe proves a tool-free run.

The id `opencode` names the source, the provider, and the integration agent. The native-end hook and the capture adapter must produce the same session key, so these ids must match. The provider has no engine entry, so managed policy and engine selection cannot name OpenCode.

### Capture

The source `sources.opencode` is false by default. The adapter opens `opencode.db` read-only. The file is in `$XDG_DATA_HOME/opencode` or `~/.local/share/opencode`, and an absolute `OPENCODE_DB` replaces it.

1. The adapter reads the 2.x tables `session_v2` and `session_message` first.
2. It reads the 1.x tables `session`, `message`, and `part` only for sessions that are not in `session_v2`. Version 2.x copies 1.x sessions with the same id, so a session is read once.
3. Learning text is text that the user typed. In 1.x, that is a `text` part of a user message without `synthetic` or `ignored`. In 2.x, that is a `user` message.
4. The adapter skips subagent sessions, because a model wrote their first prompt. Reasoning and tool parts become events with no text pointer.

A row text pointer names the database, the table, the row id, and a JSON path. `resolveRedacted` reads only the `part` and `session_message` tables. Sessions from before OpenCode 1.2.0 are JSON files, and the adapter does not read them.

### Delivery

A global install manages a section in the global `AGENTS.md`, a plugin file, and the shared `~/.agents/skills/shadowclone-context` skill. The configuration folder is `$OPENCODE_CONFIG_DIR`, else `$XDG_CONFIG_HOME/opencode`, else `~/.config/opencode`. A repository install writes `.opencode/plugins/shadowclone.js` and the repository skill. It does not write the repository `AGENTS.md`, which a team can share.

The plugin is one JavaScript file with no imports. It exports the 2.x `setup` form and the 1.x `server` form. When a session starts, the plugin runs `shadowclone hook native-start` and keeps the context that it returns. Before each model call, it adds that context to the system prompt through the 1.x `experimental.chat.system.transform` hook or the 2.x `context` hook. When a turn ends, it runs `shadowclone hook native-end`. Version 1.x signals the end with `session.idle`. Version 2.x sends no idle event to plugins, so the plugin uses `session.execution.succeeded`, `failed`, and `interrupted`. The `AGENTS.md` section keeps the routing text if the experimental 1.x hook changes.

In 1.x, OpenCode reads `~/.claude/CLAUDE.md` only when the global `AGENTS.md` does not exist. A new global `AGENTS.md` therefore hides that file from OpenCode 1.x. The OpenCode guide states this. OpenCode reads both `~/.agents/skills` and `~/.claude/skills`, so each global skill reaches it twice with the same content.

Shadowclone writes no `opencode.json`. A write that makes the global configuration invalid makes OpenCode drop all of it. The MCP guide shows the entry to add by hand.

The integration targets OpenCode 1.19.0 and 2.0.28.

### OpenCode qualification results

Installed-harness checks used OpenCode 1.19.0 and 2.0.28 in an isolated home, with a local OpenAI-compatible test server and synthetic prompts. No request left the machine.

1. Both versions loaded the plugin and ran `native-start` once for each session, before the first model call.
2. In both versions, the main model request held the plugin context and the managed `AGENTS.md` section. Version 1.x also adds the plugin context to its title request.
3. Version 1.x ran `native-end` when `opencode run` finished. Version 2.x ran it through the shared background service. With `opencode run --standalone`, version 2.x stops its private server before the plugin can run `native-end`.
4. Capture read both real databases. It redacted a synthetic secret in a typed prompt and returned assistant text.
5. After version 2.x migrated a 1.x database, capture read each of the three sessions once.
