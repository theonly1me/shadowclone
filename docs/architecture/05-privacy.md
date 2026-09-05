# Privacy

Shell history holds secrets. Agent transcripts hold secrets, source code, production log output, customer names, internal hostnames, and the contents of files someone opened by accident. The input got more sensitive, so the handling got stricter.

## The gate moves

The previous design put `redactSecrets` at the collector's single exit, and `.claude/skills/data-handling/SKILL.md` says the gate lives at the collector boundary. The old `docs/architecture.md` also recorded the known cost: a future source that returns its own value without going through that exit bypasses the gate silently, and `src/collector.test.ts` existed to make that loud.

With one source and one exit, that cost was affordable. With four adapters, a SQLite index, a signal miner, a distiller, an engine, and a dispatcher, a gate that works by everyone remembering to call it is a gate that will be missed. Making it loud is no longer good enough, so it is made impossible instead.

**Events carry pointers, not text.** `AgentEvent.textRef` is either a byte range in a transcript or a JSON-field selector for a content-addressed Cursor SQLite blob. The only function in the project that turns either pointer into a string is `resolveRedacted` in `src/redact/`, which selects only the eligible field and passes it through `redactSecrets` before returning.

There is no unredacted path because producing a string is the gate. A future contributor who wants raw text has to add a function that reads a file and returns its contents, which is a reviewable act, not an omission.

This is a deliberate amendment to the rule in `data-handling`, not a second gate bolted on downstream. There is still exactly one gate. It moved from the collector's exit to the point where text comes into existence, which is strictly earlier and strictly narrower. `data-handling/SKILL.md` is updated in the same change so the two documents do not disagree.

## No second copy

Shadowclone does not copy transcripts. The index stores offsets, timestamps, tool names, and event kinds. The profile stores rules written about the user, not excerpts from them.

Text is materialized in exactly one place, `src/distill/`, held in memory, redacted, sent through the engine, and dropped. Nothing writes captured text to disk at any point in the pipeline.

Replay evaluation uses the same path. Its first prompt is resolved through `resolveRedacted` inside `src/distill/replay.ts` before the engine receives it.

This makes the retention question much smaller than it was. There is no raw capture store to age out, because there is no raw capture store. What ages is the index, and the index can be deleted at any time with no loss beyond a reingest.

## Redaction has to grow

The eight existing rules were written for shell history and all of them stay. Transcripts need more, and every addition is cheap and always allowed.

Absolute paths outside the home directory, which name employers and clients. Internal hostnames and private IP ranges. Email addresses. Cloud resource identifiers such as bucket names, ARNs, and project ids. Database connection strings. Long high entropy strings in tool output that match no known provider format.

Redaction stays over eager. A false positive costs a distilled rule some context. A false negative ships a customer's hostname to a third party.

The existing property test that redaction is idempotent has to keep passing, and the existing test that ordinary commands survive untouched is what stops the new rules from redacting everything.

## Third-party data is never read

Transcripts hold data that does not belong to the user. The measured corpus contains 328 data-access tool calls: 194 Loki log queries, 111 Postgres queries, and 23 actor log queries. Those results are production log lines and database rows belonging to customers.

Redaction is the wrong control for that. Pattern matching finds an API key and does not find a customer's email address sitting in a log dump, and no amount of extra patterns fixes a category error.

So distillation input is an allowlist rather than a blocklist.

Eligible: the user's own prompts, plan and question and denial events, tool call metadata, and the assistant text immediately preceding a correction.

Never eligible, at any setting: the content of any `tool_result`, file contents from Read, Edit, or Write, thinking blocks, and every MCP data-access result. `07-enterprise.md` has the full list.

## What this protects against and what it does not

**Protected.** Secrets reaching a model through the pipeline. Third-party data in tool results, which is never read. A second copy of your transcripts existing anywhere. Data leaving to any endpoint the project chose, because the project has no endpoint and no key. One organization's rules reaching another organization's session. Learning from a source you did not enable.

**Not protected.** Anything already in the transcripts you keep. Shadowclone reads them, it does not create them, and deleting shadowclone does not delete them. The engine's own trust boundary, which is the one you accepted when you installed Claude Code or Codex. Someone with read access to your home directory, who could read the transcripts directly and does not need this tool.

The claims to make are the ones a reviewer can check against the source.

There is no shadowclone server, no account, and no key, so the project has nowhere to receive data. Model requests go to the agent CLI already installed and authenticated, on the user's own account and plan, so there is no new vendor and no new contract. Everything stored is local plain text, readable in an editor and removable in one command.

What is not claimed is that shadowclone makes a machine more private than it already is, or that any tool can make an organization compliant with anything. Compliance is a property of a deployment and a contract. `07-enterprise.md` is written for the reviewer who has to decide.

## Logging

Counts, byte sizes, hashes, and source names. `indexed 4,182 events from 37 sessions` is a log line. A sample is logged only when redacted and only under an explicit debug flag. No captured text in an error message, because errors reach crash reporters.

The one that is easy to get wrong here: a file path from a transcript is captured data. `failed to parse ~/.claude/projects/<slug>/<uuid>.jsonl` names the user's employer in the slug. Log the source name and the offset instead.

## The wipe

```bash
shadowclone forget --all
```

Removes `~/.shadowclone/` entirely: index, profile, checkpoints, receipts, and worktrees. It touches nothing it did not create, so transcripts, repos, and CLI configs are left alone. It prints what it removed by count and path, and it is in the README rather than only here.

`shadowclone forget --source claude-code` and `shadowclone forget --repo <name>` are narrower versions for people who want to keep most of a profile.

## Open questions

**What is the retention window for the index.** Pointers are not content, so the argument for aging them out is weaker than it was, but an index that names every repo worked on for two years is still a profile of a career. What the answer changes: whether `learn` prunes on every run or never.

**Should the profile be encrypted at rest.** It is derived, sensitive, and readable by anything running as the user. Encrypting it defeats the requirement that a user can open it in a text editor. What the answer changes: whether readability is enforced through a `shadowclone profile` command instead of plain files.
