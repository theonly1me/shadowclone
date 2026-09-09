# Privacy

Shell history holds secrets. Agent transcripts hold secrets, source code, production log output, customer names, internal hostnames, and the contents of files someone opened by accident. The input got more sensitive, so the handling got stricter.

## The gate moves

The previous design put `redactSecrets` at the collector's single exit, and `.claude/skills/data-handling/SKILL.md` says the gate lives at the collector boundary. The old `docs/architecture.md` also recorded the known cost: a future source that returns its own value without going through that exit bypasses the gate silently, and `src/collector.test.ts` existed to make that loud.

With one source and one exit, that cost was affordable. With four adapters, a SQLite index, a signal miner, a distiller, an engine, and a dispatcher, a gate that works by everyone remembering to call it is a gate that will be missed. Making it loud is no longer good enough, so it is made impossible instead.

**Events carry pointers, not text.** `AgentEvent.textRef` is either a byte range in a transcript or a JSON-field selector for a content-addressed Cursor SQLite blob. The only function in the project that turns either pointer into a string is `resolveRedacted` in `src/redact/`, which selects only the eligible field and passes it through `redactSecrets` before returning.

There is no unredacted path because producing a string is the gate. A future contributor who wants raw text has to add a function that reads a file and returns its contents, which is a reviewable act, not an omission.

This is a deliberate amendment to the rule in `data-handling`, not a second gate bolted on downstream. There is still exactly one gate. It moved from the collector's exit to the point where text comes into existence, which is strictly earlier and strictly narrower. `data-handling/SKILL.md` is updated in the same change so the two documents do not disagree.

## Presence before consent

Capture consent protects source content. Before consent, onboarding may determine whether a configured source root exists and is non-empty. It reduces the check to one ephemeral boolean so it can omit providers that have no local data from the questions it asks.

The check does not collect entry names, open an entry, inspect metadata beyond what the boolean needs, or retain or log a path, name, count, timestamp, or provider-specific identifier. This reveals that a supported provider has local data on the machine, which is accepted because onboarding is about to ask whether to use that provider. A project slug, repository name, transcript name, and transcript content remain unread.

Repository onboarding applies the same rule to declared guidance. It reduces the existence of supported root files or a non-empty supported skill root to one boolean. File names inside skill roots and instruction contents remain unread until the user enables `declared-rules`.

## No second copy

Shadowclone does not copy transcripts. The index stores offsets, timestamps, tool names, and event kinds. The profile stores derived behavioral rules and redacted repository guidance the user explicitly imported.

Every captured string is materialized through `resolveRedacted`. Transcript excerpts are held in memory under `src/distill/`, sent through the selected engine, and dropped. Repository guidance is redacted first under `src/importRules/`, then stored locally as the profile text the user asked to import. Deep reconciliation reads profile and rejection files through whole-file `FileTextRef` values and `resolveRedacted` before their text can enter a prompt. Persistent rule, rejection, origin, repository, and evidence identities remain local behind opaque prompt tokens. No unredacted captured text is written by either path.

Replay evaluation uses the same path. Its first prompt is resolved through `resolveRedacted` inside `src/distill/replay.ts` before the engine receives it.

This makes the retention question much smaller than it was. There is no raw capture store to age out, because there is no raw capture store. What ages is the index, and the index can be deleted at any time with no loss beyond a reingest.

## Sliced redaction

Rather than replacing every recognized provider token with a generic placeholder, redaction preserves only its public identifying prefix and removes the secret portion. For example, AWS keys preserve `AKIA` and Stripe keys preserve `sk_live_`. Generic hexadecimal and high-entropy tokens have no public prefix, so no matched characters survive.

Home directory scrubbing uses anchored path-boundary replacement rather than naive global string replacement, preventing mangled substrings inside mounted paths or Windows paths.

The secret rules cover provider API keys (OpenAI, Anthropic, Stripe, Google AI), GitHub tokens, Slack tokens, AWS access key IDs, JSON Web Tokens, PEM private key blocks, generic secret assignments (`KEY=`, `TOKEN=`, `PASSWORD=`), database URLs, Git remote credentials, IP addresses, internal hostnames, cloud resources, and Windows or Unix absolute paths.

In addition to deterministic rules, candidate high-entropy tokens are evaluated through a Shannon entropy gate (>= 4.5 bits/char over candidates) to catch unstructured credentials that do not match provider-specific prefixes. The whole matched token is removed.

The property test that redaction is idempotent continues to hold, and an adversarial corpus tests both raw strings and production JSONL message envelopes.

## Third-party data is never read

Tool results can contain production logs, database rows, credentials, third-party data, and other sensitive information that cannot be reliably identified through redaction alone. Shadowclone therefore excludes tool-result payloads categorically rather than attempting to sanitize and reuse their contents.

Redaction is the wrong control for that. Pattern matching finds an API key and does not find a customer's email address sitting in a log dump, and no amount of extra patterns fixes a category error.

So distillation input is an allowlist rather than a blocklist.

Eligible correction evidence: the user's own prompts, plan and question and denial events, tool call metadata, and the assistant text immediately preceding a correction. Existing profile text and prior rejection text enter reconciliation only after their original source was enabled and the stored files pass through `resolveRedacted` again. Package-owned seed siblings may enter as proposal choices.

Never eligible, at any setting: the content of any `tool_result`, file contents from Read, Edit, or Write, thinking blocks, and every MCP data-access result. `07-enterprise.md` has the full list.

## What this protects against and what it does not

**Protected.** Secrets reaching a model through the pipeline. Third-party data in tool results, which is never read. A second copy of your transcripts existing anywhere. Data leaving to any endpoint the project chose, because the project has no endpoint and no key. One owner's rules reaching another owner's session. Learning from the contents of a source you did not enable.

**Not protected.** Anything already in the transcripts you keep. Shadowclone reads them, it does not create them, and deleting shadowclone does not delete them. The engine's own trust boundary, which is the one you accepted when you installed Claude Code or Codex. Someone with read access to your home directory, who could read the transcripts directly and does not need this tool.

The claims to make are the ones a reviewer can check against the source.

There is no shadowclone server, no account, and no key, so the project has nowhere to receive data. Model requests go to the agent CLI already installed and authenticated, on the user's own account and plan, so there is no new vendor and no new contract. Everything stored is local plain text, readable in an editor and removable in one command.

What is not claimed is that shadowclone makes a machine more private than it already is, or that any tool can make an organization compliant with anything. Compliance is a property of a deployment and a contract. `07-enterprise.md` is written for the reviewer who has to decide.

## Logging

Counts, byte sizes, hashes, and source names. `indexed 4,182 events from 37 sessions` is a log line. Repository import reports counts only and prints no path, title, body, or repository identity. A sample is logged only when redacted and only under an explicit debug flag. No captured text appears in an error message, because errors reach crash reporters.

The one that is easy to get wrong here: a file path from a transcript is captured data. `failed to parse ~/.claude/projects/<slug>/<uuid>.jsonl` names the user's employer in the slug. Log the source name and the offset instead.

## The wipe

```bash
shadowclone forget --all
```

Removes `~/.shadowclone/` entirely: index, profile, checkpoints, receipts, and worktrees. It touches nothing outside that directory, so transcripts, repos, and CLI configs are left alone. Repository-local `.claude/agents/shadowclone.md`, `.claude/skills/shadowclone/SKILL.md`, and `.git/info/exclude` entries created by `shadowclone install` remain until uninstall support lands.

`shadowclone forget --source claude-code` and `shadowclone forget --repo <name>` are narrower versions for people who want to keep most of a profile.
