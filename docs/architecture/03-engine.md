# Agent execution

`src/engine/` is the model-process boundary shared by learning and evaluation. It invokes an installed, authenticated agent CLI. Shadowclone does not require its own model account or API key.

## Provider selection

The registry in `src/provider/` records capabilities independently from installation and authentication. Selection first checks the execution purpose, then chooses an eligible installed engine. `shadowclone doctor` reports availability.

| Engine | Learning runner | Relevant controls |
| --- | --- | --- |
| `claude-code` | Implemented | Structured output, isolated no-tools execution, caller session IDs, dollar budgets, granular tool policy |
| `codex` | Implemented | Structured output and isolated no-tools execution; no native dollar ceiling in this adapter |
| `cursor-agent` | Implemented | Prompted structured output and isolated no-tools execution; no native dollar ceiling in this adapter |
| `pi` | Implemented through an owned extension | Prepared model input and empty tools through Pi's registry; bounded private bridge, exact model selection, no dollar ceiling; evaluation unavailable |
| `antigravity` | Not implemented | Capture and native guidance are separate from engine support |
| `anthropic-api`, `openai-compatible` | Not implemented | Reserved engine identifiers |

Observation support does not imply permission to run learning or evaluation. An unsupported security option must fail before spawning the process. Provider compatibility needs live checks in addition to argument and parser tests.

Learning selection follows explicit command options, a triggering session's harness and model, saved distillation preferences, then detection. A selected unavailable or blocked harness does not silently fall back. Pi model references use exact `provider/model` identifiers from the harness's available model catalog.

## Execution purposes

`EngineRunOptions` requires an explicit purpose:

- **Learning:** no provider tools or ambient instructions; only the prepared model input is available.
- **Evaluation:** read or write access to an isolated snapshot, with live personal context blocked as required by the protocol.

The types in `src/engine/types.ts` define the request and result contract. Results include usage, model/session identity where available, structured output, errors, and observed actions. Callers must handle unknown cost and unsupported controls explicitly.

## Learning limits

One `createLearningExecution` instance owns the entire model allowance for a learning invocation, including reconciliation, consolidation, and skill maintenance. Defaults are 20 attempted calls and five minutes. Claude also receives a cumulative $2 ceiling. Setup uses 12 calls, 90 seconds, and a supported $1 ceiling. These limits apply to model work, not the preceding local scan.

Dollar-limited calls run serially. Each call receives the remaining allowance after the preceding result settles. Unknown spend prevents further calls under that allowance. Engines without dollar enforcement use call and time limits; the adapter does not send unsupported budget flags.

Attempts, failures, and timeouts consume calls. A deadline aborts the provider request. Completed checkpoints can be reused without another model call.

## Isolation and process handling

Learning adapters disable tools, hooks, MCP access, ambient instructions, and native memory through provider-specific controls. An empty auto-approval list alone is not a no-tools boundary. Prompt text and settings use controlled input channels, and provider output is bounded.

Pi's extension bypasses the coding agent loop for learning by calling `modelRegistry.streamSimple` with only prepared messages and an empty tool set. Live session requests use a private authenticated socket, preserving session-registered providers. Standalone requests invoke an extension command in the installed Pi CLI from an empty temporary directory. Trusted global provider extensions and Pi credential resolution remain available; ambient coding instructions and tools do not enter the nested request. Pi evaluation remains disabled because its tool loop lacks qualified enforcement of Shadowclone's execution restrictions.

Evaluation uses purpose-specific filesystem and process restrictions. Verification is a separate no-network process without provider credentials. Unsupported isolation fails before the affected operation. Authentication refresh may need to happen outside the restricted run.

Unit tests use synthetic provider streams and check arguments, output parsing, timeouts, cancellation, and boundaries. Installed-CLI contract tests use isolated local mocks. Authenticated model runs are separate verification with an explicit scope and budget.

See [acting](04-acting.md), [evaluation](09-evaluation.md), and [data handling](../data-handling.md#what-reaches-a-model) for their caller contracts.
