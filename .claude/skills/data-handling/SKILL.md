---
name: data-handling
description: The rules for anything that captures, stores, sends, or acts on the user's data. Load this before touching src/observe/, src/index/, src/redact/, src/profile/, src/distill/, src/engine/, src/dispatch/, any new capture source, any code that makes a network call, and any code that lets the clone act as the user. Use when the user says "add a collector", "capture X", "send this to the model", "store the profile", "let it act on its own", or asks about privacy, redaction, retention, or telemetry. Not for ordinary refactors that touch none of those.
---

# Data handling

Load `clean-code` first. This skill adds the rules that only matter because of what this project is.

Shadowclone processes consented agent sessions and applies derived guidance. Both can contain sensitive data. Changes must preserve source consent, scoped storage, and explicit execution boundaries.

## Consent: every source is opt-in and named

The set of things shadowclone reads is a list the user can see and edit. It is never implicit and it never grows as a side effect of another change.

- A new capture source ships with its own config flag, defaulting to off.
- The source appears in the README's list of what gets read, in the same commit that adds it.
- Widening an existing source counts as a new source. Reading `~/.bash_history` when you previously read `~/.zsh_history` is a new source. Reading full file contents when you previously read filenames is a new source.
- Before consent, onboarding may determine whether a configured source root exists and is non-empty. The result is one ephemeral boolean. Do not collect entry names, open an entry, inspect metadata beyond what the boolean needs, or retain or log a path, name, count, timestamp, or provider-specific identifier.
- Git remote discovery is the `git-metadata` source. Transcript consent never enables it. When disabled, working directories stay isolated and no repository path is opened.

## Learning capture: one gate, and it is `redactSecrets`

Captured text used for learning must pass `redactSecrets` in `src/redact/` before reaching a model or diagnostic output. Do not send raw capture to telemetry or crash reporting.

- **The gate lives inside `resolveRedacted`**, the only exported function that turns a `TextRef` into a string. Events and signals carry pointers, never captured text. Redaction happens once, when an eligible excerpt is materialized for distillation.
- Do not add a second redaction call downstream as a safety net. Two gates means neither is the gate, and the next person cannot tell which one is authoritative.
- **Every new source ships a test that proves the wiring, not just the function.** `src/redact/index.test.ts` proves the patterns work. `src/observe/index.test.ts` proves an adapter leaves text behind `resolveRedacted`. A new source needs the second kind, and per `scoped-fix` you prove it by mutating the call away and watching the test go red.
- Redaction is deliberately over-eager. A false positive costs a distilled skill some context. A false negative ships a key to a third party. When in doubt, redact.
- Adding a pattern to `redactionRules` is cheap and always allowed. Removing one needs a reason in the PR description.

Tool results, file contents from Read, Edit, or Write, thinking blocks, and data-access results never receive a `TextRef` that enters distillation. Exclude them by category.

Coding execution has a separate boundary: a user-authorized run can expose the selected repository to its agent, and transfer judges receive unredacted generated code. Use only authorized repositories. Keep code evidence local outside the approved model requests; do not treat it as safe for logs or publication. See `docs/architecture/05-privacy.md` and `docs/architecture/09-evaluation.md`.

### When you add a network call

Ask whether the request is necessary, whether a count or hash is enough, which consent authorizes it, and which documented data boundary applies. Do not widen learning capture to support a coding workflow.

## Storage: local-first, under the user's control

- The profile lives on disk in a directory the user owns and can open in a text editor. Plain files over an opaque database, because a user who cannot read what was learned about them cannot consent to it.
- The SQLite index stores pointers, event kinds, and tool metadata, never captured text. It is disposable and rebuildable.
- Never sync, upload, or back up the profile by default.
- Treat user edits and generated work as valuable. Destructive writes need tests and must preserve unrelated files.

## Logging: never the raw capture

Debugging a collector by printing what it collected is how a secret ends up in a scrollback buffer, a CI log, or a screenshot in a bug report.

- Log counts, byte sizes, hashes, and source names. `indexed 4,182 events from 37 sessions` is a useful log line.
- If you must log a sample, log the redacted text, and only under an explicit debug flag.
- No raw capture in an error message or a thrown exception either. An exception ends up in a crash reporter.
- A transcript path is captured data because its project slug can name an employer. Log the source name and opaque locator instead.

## Acting as the user: tiered, and the top tier always asks

The boundary for acting on the user's behalf must be explicit at each call site.

- **Observe and derive.** Reading capture, distilling it, writing to the vault. Runs unattended.
- **Draft.** Producing a message, diff, reply, or file and leaving it local for the user. Runs unattended, as long as nothing is sent or committed.
- **Act.** Anything that sends, posts, commits, pushes, deletes, spends, or changes state another person can see. **Requires explicit approval per action.** Not per session, not per category, not a setting the user turned on once. The approval names the specific thing being done.

Approval granted for one action does not extend to the next one, and "the user asked me to handle their email" is not approval to send a particular email.

`shadowclone run "<task>"` names the task and target repository, so that invocation approves one local worktree, branch, and commit. A remote action also requires a repo policy ceiling and a matching `--approve` on that run. Approval never carries into another run.

## Retention

- Shadowclone creates no raw capture store and never makes a second copy of a transcript.
- There is one documented command that wipes everything shadowclone has stored, and it is in the README. A user who wants out gets out in one step.

## The check before you present

For any diff touching capture, storage, or egress:

```bash
bun test
git diff -U0 | grep -nE '(console\.(log|error|warn)|fetch\(|generateText|writeFile|Bun\.spawn)'
```

Read every hit and answer, out loud in your report, where the redaction gate sits relative to it.
