---
name: data-handling
description: The rules for anything that captures, stores, sends, or acts on the user's data. Load this before touching src/collector.ts, src/redact/, src/vault.ts, src/distiller.ts, any new capture source (browser history, editor state, git activity, clipboard, screen), any code that makes a network call, and any code that lets the clone act as the user. Use when the user says "add a collector", "capture X", "send this to the model", "store the skills", "let it act on its own", or asks about privacy, redaction, retention, or telemetry. Not for ordinary refactors that touch none of those.
---

# Data handling

Load `clean-code` first. This skill adds the rules that only matter because of what this project is.

Shadowclone runs on the user's own machine and watches them work. That is the product, and it is also the entire risk. The shell history it reads holds API keys, customer names, private hostnames, and file paths that say where someone works and what they work on. A bug in a normal app degrades an experience. A bug here hands a third party the user's secrets, or destroys the behavioral history they cannot recreate.

**The user is not the adversary and neither are you. The adversary is a mistake nobody noticed.** Every rule below exists so a mistake is loud instead of silent.

## Consent: every source is opt-in and named

The set of things shadowclone reads is a list the user can see and edit. It is never implicit and it never grows as a side effect of another change.

- A new capture source ships with its own config flag, defaulting to off.
- The source appears in the README's list of what gets read, in the same commit that adds it.
- Widening an existing source counts as a new source. Reading `~/.bash_history` when you previously read `~/.zsh_history` is a new source. Reading full file contents when you previously read filenames is a new source.
- Never read a path the user did not opt into to "check whether it exists". Existence is data.

## Egress: one gate, and it is `redactSecrets`

Nothing derived from the user's machine leaves it without passing `redactSecrets` in `src/redact/`. Not to the model, not to a log aggregator, not to a crash reporter, not to a metrics endpoint.

- **The gate lives at the collector boundary**, so redaction happens once, on the way out of capture, before anything downstream can hold the raw text. `getRecentShellHistory` returns redacted text and that is the contract.
- Do not add a second redaction call downstream as a safety net. Two gates means neither is the gate, and the next person cannot tell which one is authoritative.
- **Every new source ships a test that proves the wiring, not just the function.** `src/redact/index.test.ts` proves the patterns work. `src/collector.test.ts` proves the collector actually calls them. A new source needs the second kind, and per `scoped-fix` you prove it by mutating the call away and watching the test go red.
- Redaction is deliberately over-eager. A false positive costs a distilled skill some context. A false negative ships a key to a third party. When in doubt, redact.
- Adding a pattern to `redactionRules` is cheap and always allowed. Removing one needs a reason in the PR description.

### When you add a network call

Ask, in this order: does this need to leave the machine at all, can it leave as a count or a hash instead of content, and has it passed the gate. Most things that feel like they need to be sent do not.

## Storage: local-first, under the user's control

- The vault lives on disk in a directory the user owns and can open in a text editor. Plain files over an opaque database, because a user who cannot read what was learned about them cannot consent to it.
- Never sync, upload, or back up the vault by default.
- Anything the vault holds is derived and disposable. Losing it costs the user learned behavior, so a destructive write needs a test, but it never costs them their actual work.

## Logging: never the raw capture

Debugging a collector by printing what it collected is how a secret ends up in a scrollback buffer, a CI log, or a screenshot in a bug report.

- Log counts, byte sizes, hashes, and source names. `read 412 lines from ~/.zsh_history` is a useful log line.
- If you must log a sample, log the redacted text, and only under an explicit debug flag.
- No raw capture in an error message or a thrown exception either. An exception ends up in a crash reporter.

## Acting as the user: tiered, and the top tier always asks

The clone acting on the user's behalf is the point of the project, so the boundary has to be explicit rather than a matter of judgment at the call site.

- **Observe and derive.** Reading capture, distilling it, writing to the vault. Runs unattended.
- **Draft.** Producing a message, a commit, a reply, a file, and leaving it staged for the user. Runs unattended, as long as nothing is sent or committed.
- **Act.** Anything that sends, posts, commits, pushes, deletes, spends, or changes state another person can see. **Requires explicit approval per action.** Not per session, not per category, not a setting the user turned on once. The approval names the specific thing being done.

Approval granted for one action does not extend to the next one, and "the user asked me to handle their email" is not approval to send a particular email.

## Retention

- Capture has a window. Old raw capture is deleted, not kept in case it becomes useful.
- There is one documented command that wipes everything shadowclone has stored, and it is in the README. A user who wants out gets out in one step.

## The check before you present

For any diff touching capture, storage, or egress:

```bash
bun test
git diff -U0 | grep -nE '(console\.(log|error|warn)|fetch\(|generateText|writeFile)'
```

Read every hit and answer, out loud in your report, where the redaction gate sits relative to it.
