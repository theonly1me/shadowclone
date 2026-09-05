# Engine

One interface, two uses, five implementations. `src/engine/` is the only place in the project that causes a model to be called. Distillation uses it and dispatch uses it, which means there is one thing to audit rather than two.

## No key ships

Shadowclone does not have an API key, does not ask for one, and has no server to hold one. It runs the agent CLI already installed and already logged in on the machine.

| Engine | Auth it inherits | Cost to the maintainer | Cost to the user |
| --- | --- | --- | --- |
| `claude-code` | Claude Code OAuth, Pro, Max, or Team | none | subscription quota |
| `codex` | ChatGPT subscription | none | subscription quota |
| `cursor-agent` | Cursor subscription | none | subscription quota |
| `anthropic-api` | `ANTHROPIC_API_KEY` if set | none | their key |
| `openai-compatible` | base URL, covers Ollama | none | none when local |

The last row is the zero-egress path. Pointing `openai-compatible` at a local Ollama endpoint gives a complete shadowclone that makes no network call at all. That is the answer for anyone whose employer would never allow this otherwise.

Selection order is Claude Code, then Codex, then Cursor, then a key if one is present, then a configured local endpoint. `shadowclone doctor` prints what was found, what is authenticated, and which one will be used.

The Claude Code engine and doctor are built in Phase 3. Codex and Cursor land in Phase 5. API and local endpoint implementations remain later work, so the detector never claims they are available today.

## Interface

```ts
export type EngineId =
  | "claude-code"
  | "codex"
  | "cursor-agent"
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
codex exec "<task>" --json --sandbox workspace-write -C <worktree> -m <model>
```

`-c key=value` sets any config value per invocation, including `model_reasoning_effort`. `--output-schema <FILE>` gives structured output for distillation, matching `--json-schema` on the Claude side. `-o` writes the last message to a file, which is a simpler read than the event stream when only the final answer is wanted.

Codex has its own sandbox, so `--sandbox workspace-write` plus a worktree is defence in depth rather than one layer.

## Compiled profile

The engine is handed one file, not five. `src/profile/inject.ts` compiles `~/.shadowclone/profile/*.md` into `.compiled.md`: rules above a confidence threshold, ordered by observation count, with provenance comments stripped and any `projects/<repo>.md` matching the target repo appended.

Compilation is where the profile stops being a document and becomes a prompt, so it is a named step with its own file rather than string building inside the runner.

The compiler reads `global/` and exactly one matching organization directory, strips provenance, and places hand-written rules first. The current confidence threshold is zero until the confidence model in the open questions is settled, so compilation does not silently discard a rule the user can see.
