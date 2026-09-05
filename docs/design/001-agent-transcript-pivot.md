# Learn from agent transcripts, act through the user's own subscription

## Summary

Shadowclone stops learning from shell history and starts learning from the transcripts that Claude Code, Codex, and Cursor already write to disk, then acts by driving those same CLIs under the user's existing subscription instead of calling a model API with a key the project supplies. The redaction gate moves from the collector's exit to the point where captured text comes into existence, so bypassing it requires writing a new file reader rather than forgetting a function call. Full architecture is in `docs/architecture/`, and this document covers the change from what exists today.

## Problem

Shell history is the wrong input for the stated goal. It records what a person typed into a terminal, which is `git status`, `bun test`, and a lot of `cd`. It does not record why an approach was chosen, what was rejected, how work is verified before it is called done, or what an agent is not allowed to do. Most people are not heavy terminal users, so for most people the file is close to empty and the resulting profile is close to nothing.

The input that does record those things is already on the machine and nothing reads it. On the development machine this was measured on, `~/.claude/projects/` holds 372 transcripts, 562 MB, 175,218 records and 43,022 tool calls across 30 active days, and `~/.claude/history.jsonl` holds 742 prompts in the user's own words. Codex writes the equivalent under `~/.codex/sessions/`. That corpus is a turn by turn recording of a person steering an agent, which is the exact task the clone is being built to perform.

The second problem is cost and adoption. `src/distiller.ts` hardcodes `openai("gpt-5-nano")` and requires an `OPENAI_API_KEY`. Requiring a key is the largest drop off point for a local AI tool, and any hosted alternative puts the maintainer on the hook for other people's inference bills. Meanwhile `claude`, `codex`, and `cursor-agent` are installed and authenticated on the target machine already.

The third problem is that the current egress gate does not survive the first one. `docs/architecture.md` recorded the known cost of a single gate at the collector exit: a source that returns its own value bypasses it silently, with `src/collector.test.ts` as the mitigation. That cost was affordable with one source and one exit. This change introduces four adapters, an index, a signal miner, a distiller, an engine, and a dispatcher, and a gate that depends on everyone remembering to call it will be missed.

## Prerequisites

At least one of `claude`, `codex`, or `cursor-agent` installed and authenticated, or an API key, or a local OpenAI compatible endpoint. Without one, `shadowclone learn --deep` and `shadowclone run` cannot work, though structural profiling still runs offline.

Bun 1.3 or later, for `bun:sqlite` and `Bun.spawn`. Without it the index and the engine have no runtime.

Git 2.5 or later, for `git worktree`. Without it every clone run would have to use the user's working tree, which the design forbids.

## Design

The pipeline becomes `observe -> index -> signal -> distill -> profile -> dispatch`, with `src/engine/` as the single place a model is called and `src/cli/` as the only module aware of more than one stage.

`AgentEvent` carries a `TextRef` of file path, byte offset, and length, and never a string. The only function that turns a `TextRef` into text is `resolveRedacted`, which reads those bytes and passes them through the existing `redactSecrets` before returning. Producing a string is the gate.

```ts
export type TextRef = {
  readonly sourcePath: string;
  readonly byteOffset: number;
  readonly byteLength: number;
};

export function resolveRedacted(options: { ref: TextRef }): Promise<string>;
```

Ingest is incremental through a per file cursor of `sourcePath`, `byteSize`, `modifiedAt`, and `byteOffset`, because the corpus grows about 19 MB a day. A `byteSize` smaller than the recorded offset means the file was rewritten, so the cursor is discarded and the file rescanned. A partial trailing line is never parsed, so a transcript being written to during ingest is safe to read.

Signal derivation splits by whether it needs a model. Structural signals are computed in pure code over the index and cost zero tokens. Semantic signals come from the correction miner, which extracts the moments where the user overrode the agent: plan rejections, answered questions, permission denials, correction prompts, undone edits, and verification rituals. The miner reduces the corpus roughly a thousand to one, so what reaches a model is a few hundred KB of extracted moments and never a raw transcript.

The profile is markdown at `~/.shadowclone/profile/`, one file per concern, with provenance recorded per rule as an HTML comment carrying observation count, confidence, and last seen date. The writer parses the existing file before writing, so a rule the user edited is carried forward verbatim and a rule the user deleted is recorded in `.rejected` and never proposed again.

`src/engine/` exposes `runAgent(options): Promise<EngineRun>` over five implementations, detected in order: `claude-code`, `codex`, `cursor-agent`, `anthropic-api`, `openai-compatible`. The Claude Code implementation shells out to `claude -p --output-format stream-json` with `--append-system-prompt-file` for the compiled profile and `--session-id` for a generated UUID. The UUID becomes the transcript filename under `~/.claude/projects/<slug>/`, verified against existing transcripts on disk where filename and the records' `sessionId` field matched in every case checked, so a clone run is observable by the same pipeline that observes the user.

Three mechanisms keep one organization's data out of another organization's session, and they are independent so defeating one does not defeat the others. `docs/architecture/07-enterprise.md` is the full treatment.

Rules are scoped by the git remote origin they were learned from, and the profile directory is `global/` plus one directory per organization. Compilation for a target repo reads `global/` and the single matching organization directory. A rule promotes to `global/` automatically once observed in two or more distinct organizations, on the reasoning that a habit surviving across employers belongs to the person, and otherwise only by explicit user action. A repo with no git remote is its own isolated origin and never global.

Distillation input is an allowlist. Eligible: the user's own prompts, plan and question and denial events, tool call metadata, and assistant text immediately preceding a correction, bounded in length. Never eligible at any setting: the content of any `tool_result`, file contents from Read, Edit, or Write, thinking blocks, and every MCP data-access result. Every distillation batch is single origin, so content from two organizations is never in one request.

Managed policy is read from `/Library/Application Support/shadowclone/managed.json` on macOS and `/etc/shadowclone/managed.json` on Linux, both root owned, before any user config. Every field is a ceiling rather than a default, so user config can be more restrictive and never less. `enabled: false` is a hard stop, `distillation: "local-only"` permits only the Ollama engine, and `maxActionTier: "draft"` removes push and pull request capability regardless of any repo allowlist.

The profile also compiles into a Claude Code subagent definition, written to `.claude/agents/<name>.md` for live sessions or passed as `--agents <json>` on a headless run. A session that has it can dispatch copies of the user onto subtasks with the `Agent` tool, several at once, under the session's own permission mode and with the user present. This is the primary way clones spawn. Headless dispatch remains for work done while the user is away.

Dispatch resolves a per repo policy, creates a worktree at `~/.shadowclone/worktrees/<runId>` on branch `shadowclone/<slug>`, runs the engine with the policy expressed as `--allowedTools`, `--disallowedTools`, `--permission-mode`, and `--max-budget-usd`, and writes a receipt. A capability the policy withholds is removed from the tool list rather than left available behind a prompt. The allowlist ships empty for every repo, so the default ceiling is a branch and a commit.

## Files

| Path | Change |
| --- | --- |
| `LICENSE` | New. MIT. |
| `docs/architecture.md` | Moved to `docs/architecture/README.md` and rewritten. |
| `docs/architecture/0{1..7}-*.md` | New. Capture, profile, engine, acting, privacy, roadmap, enterprise. |
| `src/paths.ts` | New. Every path the project reads or writes. |
| `src/config/` | New. `~/.shadowclone/config.toml`, all sources default off. |
| `src/config/managed.ts` | New. Root owned policy, read before user config, every field a ceiling. |
| `src/redact/` | `src/redact.ts` becomes a folder. Rules split out, transcript patterns added, `resolveRedacted` added. |
| `src/redact.test.ts` | Moved into the folder. All twelve tests unchanged. |
| `src/observe/` | New. `AgentEvent`, cursor, and one adapter per source. |
| `src/collector.ts` | Becomes `src/observe/adapters/shell.ts`, emitting events, off by default. |
| `src/index/` | New. `bun:sqlite` cache of cursors and event skeletons. |
| `src/signal/` | New. Structural derivation and the correction miner. |
| `src/distill/` | New. Replaces `src/distiller.ts`. Calls the engine, never a provider. |
| `src/distiller.ts` | Deleted. |
| `src/profile/` | New. Read, render, parse, and compile the profile. |
| `src/profile/scope.ts` | New. Origin tagging, automatic promotion, and per session rule selection. |
| `src/profile/agent.ts` | New. Compiles the profile into a `.claude/agents/<name>.md` subagent definition, also emitted as `--agents` JSON. |
| `src/distill/eligible.ts` | New. The allowlist of event kinds that may be distilled. |
| `src/vault.ts` | Deleted. The empty stub is replaced by `src/profile/`. |
| `src/engine/` | New. One interface, five implementations, plus detection. |
| `src/dispatch/` | New. Worktree, policy, receipt. |
| `src/cli/` | New. Replaces `src/index.ts`. |
| `src/index.ts` | Deleted. |
| `README.md` | Privacy and Quickstart rewritten for the new sources. License set to MIT. |
| `.claude/skills/data-handling/SKILL.md` | Egress section updated to describe the relocated gate. |
| `package.json` | `ai`, `@ai-sdk/openai` removed. Nothing added. |

## Data handling

Reads: agent transcripts under `~/.claude/projects/`, `~/.claude/history.jsonl`, `~/.codex/sessions/`, `~/.cursor/chats/`, and optionally the shell history files. Every source is opt in with a config flag defaulting to off and a README entry in the same change. A disabled source is not opened, including to check whether it exists.

Stores: `~/.shadowclone/` only. The index holds offsets, timestamps, tool names, and event kinds. The profile holds rules written about the user. Neither holds captured text, because events carry pointers rather than strings, so no second copy of any transcript is created anywhere.

Leaves the machine: redacted excerpts sent through `src/engine/` to whichever agent CLI the user already has authenticated, on their own account and plan. The gate sits before every one of those paths without exception, because the excerpt only exists as a string after `resolveRedacted` produced it. There is no code path that yields unredacted captured text.

The gate relocation is a deliberate amendment to the rule in `.claude/skills/data-handling/SKILL.md`, which currently states that the gate lives at the collector boundary. It is not a second gate added downstream as a safety net. There is still exactly one, moved strictly earlier and made structurally unavoidable, and the skill file is updated in the same change so the two do not disagree.

Redaction rules grow to cover transcript content: absolute paths outside the home directory, internal hostnames and private IP ranges, email addresses, cloud resource identifiers, and database connection strings. No existing rule is removed.

Third-party data in tool results is excluded by category rather than redacted. The measured corpus holds 328 data-access calls, 194 Loki queries, 111 Postgres queries, and 23 actor log queries, whose results are customer log lines and database rows. Pattern matching cannot reliably find a customer email in a log dump, so those results are never read into the distillation path at all.

Derived rules are scoped to the organization they were learned from and are never compiled into a session targeting a different organization. This is the control that makes the tool usable on a work laptop, and it has no equivalent in the previous design because the previous design had one source and no concept of a target repo.

An administrator can constrain or disable the tool with a root owned policy file that user config cannot widen.

Acting is tiered per `data-handling`. Observe, derive, and draft run unattended. Anything another person can see is gated by a per repo allowlist that ships empty.

## Alternatives

**Keep shell history as the primary source.** Cheapest to start, and wrong. It answers a different question from the one the product asks, and it is empty for most of the intended users.

**Ship a hosted API key or a proxy.** Removes a setup step and creates an unbounded bill, a server to secure, and a second trust boundary the user did not ask for. It also makes the honest privacy line impossible to say.

**Keep the AI SDK and require `OPENAI_API_KEY`.** Works today and blocks adoption tomorrow. It also wastes the fact that the target user has already paid for and authenticated a better agent than a raw completion call.

**Store transcript excerpts in the index for faster mining.** Faster, and it creates a second copy of the user's most sensitive data in a database they cannot read. The pointer design costs a file read per excerpt and is worth it.

**Keep the gate at the collector exit and rely on the wiring test.** Consistent with what is written today, and it does not survive going from one source to four with five downstream stages. Making the mistake loud is weaker than making it impossible.

**Redact third-party data harder instead of excluding it.** More permissive, and a category error. Redaction matches patterns, and a customer name in a log line matches no pattern. Excluding tool results costs some context about what the user was doing and removes the entire class of failure.

**One global profile with no origin scoping.** Simpler, better rules sooner, and unusable at any company. It moves data derived in an employer's repo into sessions on repos the employer has no relationship with.

**Embeddings and a vector store for the profile.** Better recall, and unreadable. A user who cannot open the file cannot argue with what it says about them, and arguing with it is the mechanism by which it improves.

## Accepted costs

Reading a `TextRef` costs a file read at distillation time rather than a database read. Distillation is already the slow, rate limited stage, so the read is not the bottleneck.

A `TextRef` dangles if the user deletes a transcript between ingest and distillation. The resolver treats a missing file or a shrunken file as a skipped signal rather than an error, which means a deleted transcript silently reduces profile quality.

Deep distillation spends the user's own subscription quota, which is exhaustible and shared with their real work. Batching, checkpointing, a cheap default model, and printing the estimate before spending are the mitigations, and none of them make it free.

Structural signals alone produce a partial profile. Anyone who never enables deep distillation gets the offline tier and nothing more.

The correction miner's regex based extractor will produce false positives, so some rules will be wrong. Provenance and user editing are the correction mechanism, which means the profile is wrong until someone reads it.

Origin scoping makes the profile worse at first. A rule observed only in one organization stays there, so a user who works mostly in one repo gets a smaller `global/` profile than a single pooled profile would give them. Automatic promotion at two organizations and manual promotion are the mitigations, and neither recovers the full pooled quality.

Excluding tool results removes real signal. Knowing that a test failed and what the failure was would improve a rule about verification habits. That signal is given up, deliberately, because the same field can hold a customer's data.

Managed policy can be bypassed by a user with root on their own machine. The file is a control for a managed fleet, not a defence against the machine's owner, and it is not presented as one.

Dropping `ai` and `@ai-sdk/openai` means losing structured output helpers. Both `claude --json-schema` and `codex --output-schema` provide the equivalent, and the API implementations carry their own parsing.

## Testing

`bun run typecheck && bun test` gates every phase.

Redaction keeps all twelve existing tests unchanged, and gains one per new pattern plus a test that the new patterns leave ordinary text untouched. The existing idempotence test must keep passing, since transcript patterns are the most likely thing to break it.

Every adapter ships a wiring test in the shape of the existing `src/collector.test.ts`: write a fixture transcript containing a planted secret to a temp directory, run the adapter through its real entry point, and assert the secret is absent and the placeholder is present. Testing `redactSecrets` alone does not count.

The index gets a test that a second ingest of an unchanged corpus advances no cursor, and a test that a truncated file triggers a rescan rather than a read at a stale offset.

The engine gets a test that parses a recorded stream-json fixture into an `EngineRun`, with no process spawned. Spawning a real agent is a manual verification step, not a unit test.

Dispatch gets a test that a repo with an empty allowlist produces engine arguments containing no push capability, and that the receipt records the omission in `actionsBlockedByPolicy`.

Origin scoping gets a test that a rule learned from one organization is absent from the compiled profile for a repo in another, and a test that a rule observed in two organizations appears in `global/`. The mutation proof: make the compiler ignore scope, confirm the first test fails because a foreign rule is present, restore, confirm green.

The distillation allowlist gets a test that an event of kind `tool-result` is rejected by `eligible.ts`, and a test that a batch containing two origins is refused before any request is built.

Managed policy gets a test that a user config enabling a source the policy forbids resolves to the policy's answer, in both directions, so the ceiling holds rather than merely being read.

The mutation proof for the gate: change `resolveRedacted` to return the raw bytes without calling `redactSecrets`, print the reverted lines, run the adapter wiring test, and confirm it fails because the planted secret is present rather than because the code no longer compiles. Restore, and confirm green.

The mutation proof for the cursor: change the rescan condition so a truncated file reads from the stale offset, confirm the truncation test fails on a parse error at a record boundary, restore, and confirm green.

## Open questions

**What is the retention window for the index.** Pointers are not content, which weakens the case for aging them out, but an index naming every repo worked on for two years is still a profile of a career. The answer decides whether `learn` prunes on every run or never.

**Should the profile be encrypted at rest.** It is derived, sensitive, and readable by anything running as the user, but encrypting it defeats the requirement that a user can open it in a text editor. The answer decides whether readability is served by plain files or by a `shadowclone profile` command over an encrypted store.

**How is confidence computed.** Observation count alone overweights repetitive habits and underweights a strong preference stated once and never contradicted. The answer decides which rules survive compilation into the prompt, and therefore how the clone behaves.

**Is two organizations the right promotion threshold.** Two is enough to show a habit is not employer specific, and a contractor with many short client engagements would promote rules faster than someone with one job. The answer decides whether the threshold is a constant or a function of how long each origin was observed.

**Does the compiled profile fit in a system prompt.** A mature profile could exceed a reasonable prompt budget. The answer decides whether compilation stays a truncating sort or becomes retrieval through the MCP server planned in phase 3.

## Decision record

Agent transcripts replace shell history as the primary source, because they record how a person steers an agent and shell history does not.

Shell history is demoted to an off by default adapter rather than deleted, because its wiring test is the pattern every new adapter follows.

The engine drives the user's already authenticated CLIs, because it removes the key setup step, removes all maintainer cost, and permits the claim that shadowclone sends nothing anywhere the user's own agent is not already sending it.

Events carry `TextRef` pointers instead of strings, because it converts the egress gate from a convention into a structural property.

The index is SQLite and the profile is markdown, because the index is a rebuildable cache and the profile is the thing the user has to be able to read in order to consent to it.

Clone runs happen in a git worktree with a pinned `--session-id`, because it keeps the user's working tree untouched and makes the clone's own transcript findable by the pipeline that reads the user's.

Clones spawn primarily as subagents inside the user's own session, because it composes with the tool already open, needs no worktree or receipt, the user is present, and parallel subagents are where the multiplier lives.

Delegation is per repo with an empty default allowlist, because the repo where autonomy is useful and the repo where it is career limiting are usually on the same machine.

Rules are scoped to the organization they were learned from, because the subscription is not the boundary anyone reviewing this at a company cares about, the organization is.

A rule promotes to global after being observed in two or more distinct organizations, because a habit that survives across employers is the person's rather than any employer's.

Third-party data is excluded from distillation by category instead of being redacted, because redaction matches patterns and customer data is not a pattern.

Managed policy is a root owned file whose every field is a ceiling, because an administrator needs to constrain a fleet without editing anyone's home directory.

`bypassPermissions` and `--dangerously-skip-permissions` are never passed at any tier, because no per repo policy is worth the failure mode.
