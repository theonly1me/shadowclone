# Provider expansion

## Summary

Shadowclone adds a static provider capability registry, uses Antigravity CLI as the first observation-only registry expansion, then adds one reviewed provider at a time without weakening source consent, redaction, or action policy.

## Problem

Claude Code, Codex, and Cursor support is implemented, but provider knowledge is split across config source ids, observation routing, engine detection, doctor output, and dispatch assumptions. Adding more CLIs by extending each switch independently will make support claims inconsistent and can silently pass a security option to an engine that cannot enforce it.

"Support every CLI" is not a stable finite checklist. CLIs appear, storage formats change, and observation and execution capabilities often arrive separately. Shadowclone needs a qualification rule and an honest support level for each provider.

Antigravity demonstrates both problems. Its documented headless protocol supports structured streaming but lacks a per-run deny-all tool policy, while its local history uses generated JSONL logs plus a version-sensitive SQLite and protobuf resume store. Engine support and observation support must remain independent.

## Prerequisites

Phases 0 through 5 are merged or available as the reviewed PR stack.

Every provider has public documentation or clean-room format notes and synthetic fixtures that contain no user transcript data.

Every new capture location is named in the README and receives its own config flag defaulting to off.

## Design

`src/provider/` contains static metadata rather than executable adapters. It may import the existing `SourceId` and `EngineId` types, but the config schema and individual engine runners do not depend on it. The CLI and engine detector consume the registry, which avoids a config-to-registry cycle.

```ts
export type EngineCapabilities = {
  readonly structuredOutput: "native" | "prompted" | "none";
  readonly callerSessionId: boolean;
  readonly maxBudgetUsd: boolean;
  readonly granularToolPolicy: boolean;
  readonly isolatedNoTools: boolean;
};

export type ProviderEngine = {
  readonly id: EngineId;
  readonly implemented: boolean;
  readonly capabilities: EngineCapabilities;
};

export type ProviderDefinition = {
  readonly id: ProviderId;
  readonly captureSource: SourceId | null;
  readonly engine: ProviderEngine | null;
  readonly transcriptFormat: "jsonl" | "sqlite" | "sqlite-protobuf" | null;
};
```

The registry is the source of truth for `doctor`, engine selection, support documentation, and capability checks. It never discovers files, reads a source path, probes a binary, or grants consent. `observeAll` still checks the source flag before accessing an adapter or path.

Engine selection takes a purpose and derives requirements before choosing a runner. Distillation requires structured output and an isolated no-tools mode. Dispatch independently requires every option requested by the resolved repo policy, including session id, budget, and granular allow and deny lists. A provider that cannot enforce one requirement is not selected for that use.

Support is reported at three independent levels:

| Level | Meaning |
| --- | --- |
| Observe | An enabled local source produces normalized events and redacted pointers |
| Distill | The CLI can receive redacted excerpts in an isolated no-tools run |
| Dispatch | The CLI can enforce the full resolved worktree policy |

Antigravity adds an off-by-default `antigravity` source. The adapter first reads `~/.gemini/antigravity-cli/brain/*/.system_generated/logs/transcript_full.jsonl`. A SQLite and protobuf fallback lands only against clean-room, version-pinned synthetic fixtures. It never queries the live language-server daemon and never writes a plaintext transcript sidecar.

The registry records Antigravity's native structured output and missing isolated no-tools, budget, granular tool policy, and caller session controls. No runner or authentication probe ships in this phase. `--sandbox` restricts terminal commands but does not override global file, web, or MCP allow rules, so an empty workspace cannot make distillation safe. A later runner must use stdin, ignore tool output, and permanently forbid `--dangerously-skip-permissions`, but it does not land until the CLI can enforce a per-run deny-all policy without editing global settings.

After Antigravity, each provider lands in its own stacked PR. The initial order is Gemini CLI, GitHub Copilot CLI, OpenCode, Aider, and Amp. Goose, Amazon Q or Kiro, Windsurf, Cline, and newly verified CLIs remain in the qualified backlog.

A provider qualifies when its integration can prove all applicable claims:

1. Local capture has a documented or clean-room format and an incremental strategy.
2. Tool results, thinking, and data-access results receive no distillable pointer.
3. A planted-secret fixture passes through the real adapter and `resolveRedacted`.
4. Disabled consent prevents every path access, including existence checks.
5. Engine prompts stay off process arguments and enter only through stdin.
6. Unsupported engine ceilings fail before process creation.
7. No test fixture contains copied user or employer data.

## Files

| Path | Change |
| --- | --- |
| `src/provider/types.ts` | Provider definitions, support levels, and engine capability types |
| `src/provider/registry.ts` | Static definitions for every implemented provider |
| `src/provider/index.ts` | Public provider metadata surface |
| `src/config/schema.ts` | Adds off-by-default Antigravity consent; registry tests keep source ids aligned |
| `src/engine/detect.ts` | Selects a provider by purpose and enforceable capabilities |
| `src/observe/adapters/antigravity.ts` | Antigravity JSONL adapter |
| `src/observe/index.ts` | Routes the enabled Antigravity source |
| `src/paths.ts` | Declares Antigravity capture roots |
| `src/cli/init.ts` | Requests named Antigravity source consent |
| `src/cli/doctor.ts` | Prints observe, distill, and dispatch support separately |
| `README.md` | Adds the source and provider support matrix |

## Data handling

The Antigravity source reads only after explicit `antigravity` consent. It reads generated conversation logs and, after the fallback is proven, local SQLite and protobuf session stores. It stores event skeletons and `TextRef` locators, never transcript content.

Every eligible excerpt is resolved inside `resolveRedacted`, which remains the only captured-text egress gate. Tool output and thinking never receive an eligible locator. Phase 6 makes no Antigravity model call.

The implementation makes no local daemon request, creates no plaintext transcript copy, sends no telemetry, and never invokes a provider merely because its executable is installed.

## Alternatives

**Runtime provider plugins.** Rejected because unreviewed code could add a capture path or network call outside the consent and redaction boundaries.

**One generic command adapter.** Rejected because flags with similar names do not provide equivalent sandbox, budget, or permission guarantees.

**Treat installation as capture consent.** Rejected because permission to execute a CLI does not grant permission to read its history.

**Antigravity live-daemon scraping.** Rejected because it adds a local network dependency, works only while the daemon is alive, and encourages plaintext sidecars.

**Claim dispatch support with partial policy mapping.** Rejected because silently dropping a budget or denylist is less safe than refusing the run.

## Accepted costs

Every provider adds fixtures, parser maintenance, consent text, documentation, and manual verification. Closed or version-sensitive formats can temporarily regress to a lower support level instead of being guessed through.

The static registry requires a release to add a provider. That review boundary is intentional because each provider expands what shadowclone may read or execute.

Some CLIs will support observation or distillation before they support dispatch. The support matrix exposes that gap instead of hiding it behind one provider checkmark.

## Testing

`bun run typecheck && bun test` remains the full gate.

Registry tests prove each id is unique, every implemented adapter and runner has one definition, and support claims match capabilities.

Each observation adapter uses a synthetic fixture with a planted secret and excluded tool result, runs through `observeAll`, persists through the index, and resolves eligible text through `resolveRedacted`. Mutating the source-consent condition, the redaction call, or the excluded-category mapping must make the focused test fail before the mutation is restored.

Each implemented engine parser uses recorded synthetic stream events and never spawns a real CLI in unit tests. Argument tests prove prompts are absent, forbidden bypass flags are absent, and unsupported ceilings throw before spawn. Real authentication and one no-op structured run remain manual checks.

## Open questions

Whether current Antigravity releases always retain `transcript_full.jsonl` determines when the SQLite and protobuf fallback becomes necessary. The JSONL adapter ships only after verification against an explicitly consented local corpus.

Antigravity distillation remains blocked until its CLI documents a per-run deny-all tool policy that overrides global allow rules.

Provider order after the named backlog follows verified local transcript availability, not popularity. A CLI with no local history can receive engine support without receiving observe support.

## Decision record

Provider metadata is static and reviewed because provider addition expands sensitive access.

Observation, distillation, and dispatch are separate support levels because their security requirements differ.

Capabilities are checked before engine selection because runners may not silently ignore requested ceilings.

Antigravity uses generated logs before version-sensitive protobuf because the simplest stable source wins.

Antigravity never uses live-daemon scraping or plaintext transcript sidecars because raw capture must not be duplicated.

Antigravity remains observation-only because request-review and terminal sandboxing do not provide an isolated no-tools run.
