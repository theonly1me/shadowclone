# Bounded learning execution

## Summary

Deep learning runs through a named execution contract that removes provider tools and ambient instructions, counts every model call across extraction and merge, enforces one wall-clock deadline, and applies a cumulative dollar ceiling only when the selected provider supports one.

## Problem

`distillSignals` currently calls an `EngineRunner` directly for every extraction batch and gives `mergeDistilledRules` the same unrestricted runner. There is no total call ceiling or deadline. A large corpus can keep starting model processes until every extraction and merge completes.

Claude receives `allowedTools: []`, but `buildClaudeArguments` omits `--allowedTools` for an empty array. Claude documents `--allowedTools` as an auto-approval control and `--tools ""` as the control that removes built-in tools. Ordinary distillation also loads `user,project` setting sources, so a permissive `.claude/settings.json`, hooks, MCP servers, skills, memory, and repository instructions can affect a process that receives redacted transcript excerpts.

Codex rejects `maxBudgetUsd`, so passing a dollar limit to every provider breaks Codex before it spawns. Cursor has no dollar-budget flag and reads global configuration in addition to its workspace. Provider capability metadata already distinguishes dollar-budget support and isolated no-tools support, but the learning path does not use those capabilities when it builds each request.

## Prerequisites

The provider registry must remain the source of truth for implemented engines, isolated no-tools support, and dollar-budget support. Without that lookup, the coordinator could silently request a control that the selected engine cannot enforce.

Profile lifecycle PR 3 remains the stack base because `distillSignals` returns the current `ProfileRule` representation and its checkpoints use the current profile schema.

## Design

`EngineRunOptions` receives a required discriminated execution value instead of the evaluation boolean and separate blocked-path field.

```ts
export type EngineExecution =
  | { readonly purpose: "dispatch" }
  | {
      readonly purpose: "evaluation";
      readonly blockedPaths?: readonly string[];
    }
  | { readonly purpose: "learning" };
```

Every engine call names its purpose. Evaluation path isolation reads blocked paths only from the evaluation member. Dispatch continues to load the explicit profile and repository policy selected by its caller. Learning rejects a system prompt file, a non-empty tool list, or a permission mode other than `dontAsk` before a provider process starts.

`createLearningExecution` owns the full semantic learning run. Its default contract permits 20 attempted model calls, five minutes from construction, and two US dollars where the provider registry reports `maxBudgetUsd: true`. The limits are injectable as a complete value for tests and future configuration work.

The execution validates positive finite limits and verifies that the selected engine maps to an implemented provider with distillation support before returning a runner. Every attempted call consumes one slot, including failed or timed-out calls. The runner checks the shared deadline before each call and races the provider promise against the remaining time. A deadline aborts the provider signal and rejects with a fixed error that contains no prompt or provider output.

For a provider with dollar-budget support, each call receives the remaining total allowance through `maxBudgetUsd`. Reported `costUsd` is subtracted before the next call. Missing, negative, or non-finite cost data fails the learning run because a cumulative ceiling cannot be established from an unknown value. Providers without the capability never receive `maxBudgetUsd` and remain bounded by calls and time.

`distillSignals` constructs one learning execution before it filters and materializes eligible evidence. The bounded runner goes to every extraction call and into `mergeDistilledRules`, so checkpoints do not consume calls and all actual model requests share one allowance. Reconciliation added later must receive this same runner rather than create another contract. `engineRuns` comes from the coordinator's attempted-call count.

`learn` passes the detected engine beside its runner. Tests or other programmatic callers that inject a runner must also name its engine because capability decisions cannot be inferred safely before the first process call. The CLI reports the fixed call and time ceilings and whether the selected engine also receives the dollar ceiling.

Claude learning runs use `--restricted`, `--safe-mode`, `--no-session-persistence`, empty `--setting-sources`, strict empty MCP configuration, `--tools ""`, and an MCP deny rule. Inline settings disable hooks, automatic memory, network tools, and unsandboxed commands. The explicit learning contract determines the arguments even when the working directory contains permissive project settings.

Codex learning runs use read-only sandboxing, `approval_policy="never"`, `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, an empty MCP configuration, disabled shell, web, app, plugin, browser, image, computer-use, memory, hook, and multi-agent features, and no project instruction discovery. Codex receives no dollar flag.

Cursor learning runs use ask mode in an empty temporary workspace. `CURSOR_CONFIG_DIR` points at a second temporary directory containing the only CLI configuration, with shell, read, write, web, and MCP permissions denied. Both directories are removed after the run, including any native session state written beneath the isolated configuration root.

The [Claude CLI reference](https://code.claude.com/docs/en/cli-reference), [official OpenAI Codex command reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli), and [Cursor CLI configuration reference](https://cursor.com/docs/cli/reference/configuration) were checked on 2026-09-08 before recording these provider contracts.

## Files

| Path | Change |
| --- | --- |
| `docs/design/007-bounded-learning-execution.md` | Record the learning isolation, provider, call, time, and cost contracts |
| `docs/design/README.md` | Add this record to the chronological index |
| `docs/architecture/03-engine.md` | Describe purpose-specific execution and the implemented learning limits |
| `docs/architecture/02-profile.md` | Replace the unbounded distillation description with the shared execution allowance |
| `README.md` | State the limits applied by `learn --deep` |
| `src/engine/types.ts` | Replace evaluation booleans with a discriminated execution purpose |
| `src/engine/execution.ts` | Validate learning-only engine options and identify isolated purposes |
| `src/engine/learning.ts` | Build the provider-aware total learning runner |
| `src/engine/claudeCode.ts` | Generate the Claude learning isolation arguments |
| `src/engine/claudeIsolation.ts` | Build settings, tools, MCP, hook, memory, and persistence restrictions |
| `src/engine/codex.ts` | Apply Codex learning isolation without a dollar flag |
| `src/engine/cursorAgent.ts` | Isolate Cursor workspace, configuration, permissions, and native state |
| `src/engine/evaluationIsolation/index.ts` | Read blocked paths from the evaluation execution member |
| `src/distill/index.ts` | Share one bounded runner across extraction and merge |
| `src/distill/merge.ts` | Run merge under the learning purpose and shared allowance |
| `src/cli/learn.ts` | Supply engine identity and report the applied limits |
| `src/eval/transfer/call.ts` | Express transfer calls with the evaluation execution member |
| `src/eval/transfer/profile.ts` | Name the engine used by production profile learning inside eval |
| `src/eval/transfer/index.ts` | Pass that engine to profile learning |
| `src/engine/*.test.ts` | Prove provider isolation, budget selection, and deadline behavior |
| `src/distill/execution.test.ts` | Prove the total ceiling stops extraction before the next model call |

## Data handling

The existing distillation prompt remains the only new payload sent to a provider during learning. Eligible transcript pointers are materialized through `resolveRedacted`, whose internal `redactSecrets` call remains immediately before prompt construction and engine egress. The execution coordinator forwards that already-redacted prompt and adds only fixed policy values.

Provider stdout and stderr stay inside the existing engine adapters. Claude and Codex failure text continues through `redactSecrets` before it reaches an `EngineRun` error. New limit and validation errors are fixed strings and contain no prompt, path, settings content, transcript text, or provider output.

The new Cursor files contain only fixed deny policy and live under operating-system temporary directories. They store no transcript excerpt. The existing distillation checkpoints continue to write derived profile rules after a successful call, and no new durable store or network destination is added.

## Alternatives

**Pass `maxBudgetUsd` from `learn` to every runner.** Rejected because Codex and Cursor explicitly reject a control they cannot enforce. Provider capability selection has to happen before building options.

**Give each extraction and merge call its own limit.** Rejected because twenty extraction batches plus two merge calls would each receive a fresh allowance. The limit belongs to the user-visible learning invocation.

**Treat `allowedTools: []` as no tools.** Rejected because Claude documents that `--allowedTools` controls permission prompts rather than tool availability. `--tools ""` is the deny-all boundary.

**Use the evaluation boolean for learning.** Rejected because evaluation may execute tasks in a writable workspace, while learning must never gain tools. A discriminated purpose prevents those contracts from collapsing into one branch.

**Trust an empty working directory to isolate Cursor.** Rejected because Cursor also has user configuration, rules, MCP servers, and hooks outside the workspace. Its configuration root must be isolated for the invocation.

## Accepted costs

A manual deep-learning run can stop before the corpus is complete. Successful extraction and merge checkpoints remain, so the next invocation resumes without spending calls on finished work.

The first release uses fixed defaults rather than new configuration keys or CLI flags. This keeps the execution boundary small while reconciliation is being built. User-configurable limits can extend the same validated contract later without changing provider adapters.

Claude learning now requires a CLI version that supports `--restricted`. An older installation fails visibly at process startup instead of running with weaker isolation.

Cursor authentication with an isolated configuration root still requires real macOS and Linux verification. Browser or key-based authentication remains provider-owned, while all mutable CLI configuration and native run state is directed to the temporary root.

## Testing

A Claude argument fixture places permissive tool, hook, and MCP settings in the working directory and asserts the learning command still carries empty setting sources, safe and restricted modes, no session persistence, an empty built-in tool list, strict empty MCP configuration, and disabled hooks and memory.

A Codex learning runner test uses a one-call limit, confirms the first request has no `maxBudgetUsd`, and confirms the second request fails before the underlying runner runs. A Claude budget test confirms the second call receives the first call's reported cost subtracted from the total.

A deadline test uses a runner that does not settle and proves the coordinator aborts and returns the fixed deadline error. A distillation test creates more than one extraction batch with a one-call allowance, confirms only the first runner invocation occurs, and confirms the second batch fails with the call-limit error.

The Claude isolation test first runs against the current argument builder and fails because project settings remain enabled and `--tools ""` is absent. The Codex budget and distillation ceiling tests first run against the current direct-runner path and fail because `maxBudgetUsd` is forwarded and every batch starts. After implementation, mutate each enforcing branch, print the changed lines, and rerun the focused test to prove it fails for the intended reason.

Run `bun run check` after focused tests. Inspect all new `Bun.spawn`, `Bun.write`, errors, and console calls to confirm their payloads and the position of the redaction gate.

## Open questions

None.

## Decision record

2026-09-08: Make engine execution purpose a discriminated value because learning and evaluation require different capabilities even when both are isolated.

2026-09-08: Bound one learning invocation to 20 attempted calls, five minutes, and two US dollars where supported because extraction, merge, and future reconciliation draw from one user-visible allowance.

2026-09-08: Apply remaining dollar allowance only to engines whose registry capability supports it because an unsupported budget flag must never break a provider or disappear silently.

2026-09-08: Keep completed checkpoints when a limit stops the run because bounded work must resume rather than repeat paid calls.

2026-09-08: Isolate Cursor's configuration root as well as its workspace because an empty repository does not remove user rules, hooks, or MCP configuration.
