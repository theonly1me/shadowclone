# Engine

One interface, two uses, and provider-specific implementations. `src/engine/` is the only place in the project that causes a model to be called. Distillation uses it and dispatch uses it, which means there is one thing to audit rather than two.

## No key ships

Shadowclone does not have an API key, does not ask for one, and has no server to hold one. It runs the agent CLI already installed and already logged in on the machine.

| Engine | Auth it inherits | Cost to the maintainer | Cost to the user |
| --- | --- | --- | --- |
| `claude-code` | Claude Code OAuth, Pro, Max, or Team | none | subscription quota |
| `codex` | ChatGPT subscription | none | subscription quota |
| `cursor-agent` | Cursor subscription | none | subscription quota |
| `antigravity` | Antigravity CLI cached login | none | provider quota |
| `anthropic-api` | `ANTHROPIC_API_KEY` if set | none | their key |
| `openai-compatible` | base URL, covers Ollama | none | none when local |

The last row is the zero-egress path. Pointing `openai-compatible` at a local Ollama endpoint gives a complete shadowclone that makes no network call at all. That is the answer for anyone whose employer would never allow this otherwise.

The current selection order is Claude Code, then Codex, then Cursor. Phase 6 makes selection purpose-aware and records Antigravity's known limits without adding a runner. API keys and configured local endpoints remain later work. `shadowclone doctor` prints what was found, what is authenticated, and which providers can support each purpose.

The Claude Code, Codex, and Cursor engines are built. Antigravity, API, and local endpoint implementations remain later work, so the detector never claims they are available today.

## Capability registry

Phase 6 replaces selection by authentication alone with a static provider registry. Each provider reports native structured output, caller-selected session ids, dollar budgets, granular tool policy, and isolated no-tools execution independently. Distillation and dispatch derive their requirements before selecting an engine, and a provider missing one requirement is not selected for that purpose.

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

export type EngineRunOptions = {
  readonly prompt: string;
  readonly cwd: string;
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

An engine that cannot honour an option fails loudly at construction rather than dropping it. Silently ignoring `maxBudgetUsd` is how an unattended run empties a quota overnight.

## Claude Code

```
claude -p "<task>"
  --output-format stream-json
  --append-system-prompt-file ~/.shadowclone/profile/.compiled.md
  --session-id <uuid>
  --permission-mode acceptEdits
  --allowedTools "Read" "Edit" "Bash(bun test)" "Bash(git commit:*)"
  --max-budget-usd 2.00
  --model sonnet
  --add-dir <worktree>
```

Two flags carry more weight than the rest.

`--session-id` accepts a UUID that becomes the transcript filename under `~/.claude/projects/<slug>/`. Verified against real transcripts on disk, where filename and the records' `sessionId` field matched in every case checked.

Generating the id up front means the clone knows where its own transcript will land, so a clone run is observable by the same pipeline that observes the user.

`--agents <json>` accepts the same subagent definition that `src/profile/agent.ts` writes to `.claude/agents/`, so a headless run can carry a clone subagent without touching the repo. `02-profile.md` covers the compilation.

`--append-system-prompt-file` injects the compiled profile without replacing Claude Code's own system prompt, so the clone keeps its normal competence and gains the user's habits on top. Replacing the system prompt with `--system-prompt-file` produces a worse agent that sounds more like the user, which is the wrong trade.

The terminal `result` message carries `session_id`, `total_cost_usd`, `duration_ms`, `duration_api_ms`, `num_turns`, `is_error`, `modelUsage`, and `permission_denials`. Everything `EngineRun` needs is in one message, so the stream parser only has to buffer text blocks and wait for `result`.

Permission modes available are `acceptEdits`, `bypassPermissions`, `default`, `dontAsk`, `manual`, `plan`, and `auto`. `acceptEdits` inside a throwaway worktree is the unattended default. `bypassPermissions` is never used by shadowclone, at any tier, for any repo.

## Codex

```
codex exec - --json --sandbox read-only -C <worktree> -m <model>
```

`-c key=value` sets any config value per invocation, including `model_reasoning_effort`. `--output-schema <FILE>` gives structured output for distillation, matching `--json-schema` on the Claude side. `-o` writes the last message to a file, which is a simpler read than the event stream when only the final answer is wanted.

The prompt stays on stdin rather than the process list. Distillation disables the shell tool, removes configured MCP servers for the run, selects the read-only sandbox, and parses only completed assistant messages. Codex has no dollar-budget or granular tool-list flags, so the runner rejects those options rather than silently weakening them.

## Cursor

```
cursor-agent --print --output-format stream-json \
  --sandbox enabled --mode ask --workspace <directory>
```

Cursor also receives its prompt on stdin. A no-tools distillation run gets an empty temporary workspace whose project policy denies shell, read, write, web, and MCP tools. Ask or plan mode adds another read-only boundary. The terminal `result` event supplies the final text and duration, and tool result events are ignored. Cursor has no caller-selected session id, dollar budget, or arbitrary granular tool-list mapping, so those requests fail before a process starts.

## Compiled profile

The engine is handed one file, not five. `src/profile/inject.ts` compiles `~/.shadowclone/profile/*.md` into `.compiled.md`: rules above a confidence threshold, ordered by observation count, with provenance comments stripped and any `projects/<repo>.md` matching the target repo appended.

Compilation is where the profile stops being a document and becomes a prompt, so it is a named step with its own file rather than string building inside the runner.

The compiler reads `global/` and exactly one matching organization directory, strips provenance, and places hand-written rules first. The current confidence threshold is zero until the confidence model in the open questions is settled, so compilation does not silently discard a rule the user can see.
