# Engine

One interface, three execution purposes, and provider-specific implementations. `src/engine/` is the only place in the project that causes a model to be called. Learning, dispatch, and evaluation use it, which leaves one process boundary to audit.

## No key ships

Shadowclone has no hosted collection service and does not require a project account. Provider CLIs use their existing authentication and may receive explicitly allowlisted provider credentials. It runs the agent CLI already installed and already logged in on the machine.

| Engine | Auth it inherits | Status | Cost to the user |
| --- | --- | --- | --- |
| `claude-code` | Claude Code OAuth, Pro, Max, or Team | built | subscription quota |
| `codex` | ChatGPT subscription | built | subscription quota |
| `cursor-agent` | Cursor subscription | built | subscription quota |
| `antigravity` | Antigravity CLI cached login | metadata only | provider quota |
| `anthropic-api` | `ANTHROPIC_API_KEY` if set | planned | their key |
| `openai-compatible` | base URL, covers Ollama | planned | none when local |

Selection is purpose-aware, then follows Claude Code, Codex, and Cursor order among engines that can enforce that purpose. The registry records Antigravity's known limits without adding a runner. API keys and configured local endpoints remain planned future work. `shadowclone doctor` prints what was found, what is authenticated, and which providers can support each purpose.

The Claude Code, Codex, and Cursor engines are built. Antigravity, API, and local endpoint implementations remain planned, so the detector never claims they are available today.

## Capability registry

The static provider registry reports native structured output, caller-selected session ids, dollar budgets, granular tool policy, and isolated no-tools execution independently. Distillation and dispatch derive separate requirements before selecting an engine, and a provider missing one requirement is not selected for that purpose.

The registry contains metadata only. It does not inspect transcript paths, probe executables, or grant source consent. Observation, distillation, and dispatch remain three separate support levels.

Antigravity is the first provider whose documented engine capabilities are registered before its runner. Its headless mode provides stdin JSON events, `stream-json` output, native `--json-schema`, cached authentication, and request-review permissions. It has no documented per-run deny-all tool policy. `--sandbox` restricts terminal commands but does not override global file, web, or MCP allow rules. Its runner stays unimplemented until isolated distillation can be enforced without editing global settings.

## Interface

```ts
export type EngineId =
  | "claude-code"
  | "codex"
  | "cursor-agent"
  | "antigravity"
  | "anthropic-api"
  | "openai-compatible";

export type EngineExecution =
  | { readonly purpose: "dispatch" }
  | {
      readonly purpose: "evaluation";
      readonly blockedPaths?: readonly string[];
    }
  | { readonly purpose: "learning" };

export type EngineRunOptions = {
  readonly prompt: string;
  readonly cwd: string;
  readonly execution: EngineExecution;
  readonly systemPromptFile?: string;
  readonly sessionId?: string;
  readonly model?: string;
  readonly allowedTools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly permissionMode?: PermissionMode;
  readonly maxBudgetUsd?: number;
  readonly outputSchema?: unknown;
  readonly signal?: AbortSignal;
};

export type EngineRun = {
  readonly engine: EngineId;
  readonly sessionId: string;
  readonly transcriptPath: string | null;
  readonly text: string;
  readonly structured: unknown;
  readonly costUsd: number | null;
  readonly durationMs: number;
  readonly turns: number;
  readonly isError: boolean;
  readonly permissionDenials: readonly PermissionDenial[];
};
```

An engine that cannot honour an option fails loudly before it spawns rather than dropping it. The required execution purpose prevents evaluation, learning, and dispatch from sharing an accidental default.

## Learning contract

`createLearningExecution` wraps the selected engine once for a complete `learn --deep` invocation. Reconciliation batches and consolidation calls use the same runner. Completed checkpoints consume no call allowance.

The default permits 20 attempted calls over five minutes. Claude also receives a cumulative $2 limit because its provider capability reports native dollar-budget enforcement. Each call receives the remaining amount, and its reported cost is deducted before the next call. Codex and Cursor never receive an unsupported dollar option, so their boundary is the call count and deadline.

Learning cannot load a system prompt file, enable a provider tool, or select a permission mode other than `dontAsk`. Attempts, errors, and timeouts consume a call. Hitting a limit leaves completed checkpoints in place, so another invocation resumes from the next unfinished batch.

## Claude Code

The runner sends the prompt on stdin, disables native hooks and session persistence, clears settings sources and MCP configuration, and uses explicit tool permissions. Learning disables tools. Dispatch adds an outer OS boundary and disables automatic approval of sandboxed shell commands so the resolved tool policy still applies.

The shared process runner limits stdout and stderr and terminates the process group on overflow, timeout, or cancellation. Structured output is accepted only after a complete result. Provider authentication and billing remain provider responsibilities.

The implementation uses [Claude Code's sandbox settings](https://code.claude.com/docs/en/sandboxing) and [permission controls](https://code.claude.com/docs/en/permissions). Native permission rules and filesystem sandbox rules cover different paths and must be tested together. Missing isolation fails closed.

## Codex

```
codex exec - --json --sandbox read-only -C <worktree> -m <model>
```

`-c key=value` sets any config value per invocation, including `model_reasoning_effort`. `--output-schema <FILE>` gives structured output for distillation, matching `--json-schema` on the Claude side. `-o` writes the last message to a file, which is a simpler read than the event stream when only the final answer is wanted.

The prompt stays on stdin rather than the process list. Learning adds `--ephemeral`, `--ignore-user-config`, and `--ignore-rules`, disables instruction, memory, hook, app, plugin, browser, web, image, computer-use, multi-agent, and shell features, clears MCP configuration, and selects the read-only sandbox. Codex has no dollar-budget or granular tool-list flags, so the learning coordinator omits the former and the runner rejects direct requests for either.

## Cursor

```
cursor-agent --print --output-format stream-json \
  --sandbox enabled --mode ask --workspace <directory>
```

Cursor also receives its prompt on stdin. A no-tools run gets an empty temporary workspace whose project policy denies shell, read, write, web, and MCP tools. `CURSOR_CONFIG_DIR` points at a second temporary directory with the same deny policy, so user settings, rules, hooks, and MCP configuration do not enter the run. Ask mode and the enabled sandbox add read-only boundaries. Both directories, including native session state written there, are removed after the process exits. Cursor has no caller-selected session id, dollar budget, or arbitrary granular tool-list mapping, so those requests fail before a process starts.

## Compiled profile

`src/profile/compiler/` reads one bounded snapshot per selected profile file. It projects global, matching owner, and exact repository guidance into at most 16 KiB, dropping whole blocks when needed. User and declared guidance outrank mined candidates. A pending mined proposal does not silently replace an active user instruction.

The raw metadata and redacted visible text come from the same bytes. Compilation does not claim that pattern redaction detects every kind of sensitive content.
