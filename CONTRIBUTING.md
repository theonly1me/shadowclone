# Contributing

Thanks for looking. This is an early project, so the surface area is small and the conventions are strict. Both of those make review fast, which is the whole point.

## Setup

Needs [Bun](https://bun.sh). No Node, no npm. For anything that calls a model, at least one of `claude`, `codex`, or `cursor-agent` installed and logged in. No API key, and nothing new may depend on one.

```bash
bun install
bun run check
```

`bun run cli init` writes the opt-in config. `bun run cli learn` ingests enabled sources without making a network call. `bun run cli learn --deep` is the separate, consented path through a selected authenticated agent CLI. `bun run cli run "<task>"` explicitly approves one local worktree, branch, and commit for that task.

## The gate

Run this before you open a PR. It is what CI runs, on Linux and macOS.

```bash
bun run check        # bun run typecheck && bun run lint && bun test
```

`bun run lint` is two layers. Biome carries the TypeScript rules, including a plugin that reports any `as` cast other than `as const`. `scripts/conventions.ts` carries the three rules Biome has no rule for: files stay under 200 lines, `.ts` files hold no comments, and nothing anywhere holds an em-dash. Both print the file and line, and neither has a suppression comment you are allowed to reach for.

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

### What a bullet looks like

Good. One sentence each, present tense, saying what the code does now:

```markdown
- Route captured history through `redactSecrets` before it leaves the collector, so a shell history containing an API key no longer reaches the model.
- Rename the loop variable in `getRecentShellHistory` that shadowed the `node:path` import.
- Add `src/collector.test.ts`, covering the redaction wiring and the empty-history case.
```

Bad, and this is the exact thing the caps exist to stop:

```markdown
- **Enhanced Security Posture**: This PR introduces a comprehensive redaction layer that
  significantly improves the security of the data pipeline. By leveraging a robust set of
  regular expression patterns, we can now confidently ensure that sensitive credentials are
  properly sanitized before egress. This represents a crucial step forward for the project.
```

That bullet is four sentences, has a bold label, uses leverage, robust, comprehensive, and crucial, and after all of it a reviewer still does not know which function changed.

Some specific things to cut, because they show up in almost every generated body: an opening paragraph restating the title, a closing paragraph summarising the bullets, any sentence about what did **not** change, and any narration of how the work went. Join a change to its consequence with "so" only when the reason is not obvious from the name. "Rename `clientFiles` to `openOrDirtyFiles`" needs no second clause.

If you are over 250 words, delete sentences. Do not compress them into denser ones.

Commit messages are one line, lowercase, with a conventional-commit prefix. Check `git log --oneline`. Do not force push a branch someone has already reviewed.

## Changes that get a closer read

Anything touching capture, storage, or network egress. That is `src/observe/`, `src/index/`, `src/redact/`, `src/distill/`, `src/profile/`, `src/engine/`, `src/dispatch/`, and any new file that reads from a home directory, opens a socket, calls `fetch`, or spawns a process.

`.claude/skills/data-handling/SKILL.md` has the rules. The six that come up most:

1. **A new capture source needs an opt-in flag and a README entry in the same PR.** Reading a wider slice of a file you already read counts as a new source.
2. **Everything reaching the network passes `redactSecrets`.** The gate sits inside `resolveRedacted`, the only exported function that turns a `TextRef` into a string. Do not add a second one downstream, and do not route around it.
3. **A test proves the wiring, not just the function.** `src/redact/index.test.ts` proving a pattern works says nothing about whether an adapter keeps text behind the resolver. Every adapter under `src/observe/adapters/` ships a wiring test with a fixture transcript holding a planted secret.
4. **No raw capture in a log line, an error message, or a committed test fixture.**
5. **Tool results, file contents, and thinking blocks are never distilled.** Excluded by category, not redacted. `docs/architecture/07-enterprise.md` has the list and the reason.
6. **A rule never leaves the organization it was learned from.** Origin scoping is not optional and not a setting.

If you are unsure whether your change touches egress, it touches egress. Say so in the PR and let the reviewer decide.

## Reporting a redaction gap

If you find a string that gets past `src/redact/`, that is the most valuable bug report this project can get. Open an issue describing the **shape** of the string, not the string itself. "A GitLab personal access token starting `glpat-` is not matched" is enough to write the pattern and the test.

`SECURITY.md` covers the reports that go through private reporting instead.

## Releasing

A release is a tag. Bump `version` in `package.json`, land it, then push `v<version>`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` runs the gate, cross compiles the CLI for macOS and Linux on both architectures, writes `SHA256SUMS.txt`, attests the archives, publishes five npm packages, and publishes the release with generated notes. The npm side is `@shadowclone/cli` plus one `os` and `cpu` gated binary package per platform, so `npm i -g` installs only the binary that matches. Publishing needs an `NPM_TOKEN` repository secret. It stops before publishing if the tag does not match `version`. A tag with a hyphen, such as `v0.1.0-rc.1`, publishes as a prerelease.

`bun run build` produces the same archives in `dist/`, and running the release workflow by hand from the Actions tab builds and uploads them to the run without creating a release. Use that to test a change to the release path rather than spending a version number.
