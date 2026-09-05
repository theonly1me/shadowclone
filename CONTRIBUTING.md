# Contributing

Thanks for looking. This is an early project, so the surface area is small and the conventions are strict. Both of those make review fast, which is the whole point.

## Setup

Needs [Bun](https://bun.sh). No Node, no npm.

```bash
bun install
cp .env.example .env   # add your OPENAI_API_KEY
bun run start
```

## The gate

Run both before you open a PR. They are what CI will run.

```bash
bun run typecheck
bun test
```

## Conventions

The conventions live in `.claude/skills/clean-code/SKILL.md` rather than in this file, because agents read that path and humans can read it too. It is short. Read it once before your first PR.

The ones people trip on:

- **No `any`, no non-null `!`, no `as` casts.** Only `as const`. If the type system is fighting you, destructure and narrow instead of asserting.
- **Zero comments.** Not few. Zero. If code needs explaining, rename something, extract a named function, put the state in the type, or write a test that encodes the rule. The reasoning goes in the PR description, where it gets read.
- **Full words in names.** `statement` not `stmt`, `index` not `i`. Never shadow an import with a local name.
- **Two or more arguments take an options object.** `getRecentShellHistory({ lineCount, historyPaths })`.
- **Files stay under 200 lines,** tests included. Plan a folder module up front rather than splitting a big file later.
- **No em-dashes** in code, comments, docs, or PR text.

This applies to the existing code as much as new code, with one exception: do not open a PR whose purpose is deleting comments or renaming things you did not otherwise touch.

## PRs

`.github/pull_request_template.md` is strict on purpose, and the limits are real:

- The whole body stays under **250 words**. `wc -w` on your body before you submit.
- **What changed** is bullets, one sentence each, seven at most. If a bullet needs two sentences it is two bullets.
- **Why** is three sentences at most.
- Delete every `<!-- -->` comment and any section you did not fill in. Never write "n/a".

The reason for the caps: a PR body written by an AI assistant will happily produce four confident paragraphs where one sentence was needed, and it reads like effort while making review slower. A reviewer opens a PR to find out what changed, and every sentence between them and that answer is a cost. Short bodies get reviewed faster.

Using an assistant to help write the PR is fine. Shipping its first draft unedited is not.

Commit messages are one line, lowercase, with a conventional-commit prefix. Check `git log --oneline`. Do not force push a branch someone has already reviewed.

## Changes that get a closer read

Anything touching capture, storage, or network egress. That is `src/collector.ts`, `src/redact.ts`, `src/distiller.ts`, `src/vault.ts`, and any new file that reads from a home directory, opens a socket, or calls `fetch`.

`.claude/skills/data-handling/SKILL.md` has the rules. The four that come up most:

1. **A new capture source needs an opt-in flag and a README entry in the same PR.** Reading a wider slice of a file you already read counts as a new source.
2. **Everything reaching the network passes `redactSecrets`.** The gate sits at the collector boundary. Do not add a second one downstream, and do not route around it.
3. **A test proves the wiring, not just the function.** `src/redact.test.ts` proving a pattern works says nothing about whether the collector calls it. Add the `src/collector.test.ts` kind, and prove it catches the bug by mutating the call away and watching it go red.
4. **No raw capture in a log line, an error message, or a committed test fixture.**

If you are unsure whether your change touches egress, it touches egress. Say so in the PR and let the reviewer decide.

## Reporting a redaction gap

If you find a string that gets past `src/redact.ts`, that is the most valuable bug report this project can get. Open an issue describing the **shape** of the string, not the string itself. "A GitLab personal access token starting `glpat-` is not matched" is enough to write the pattern and the test.
