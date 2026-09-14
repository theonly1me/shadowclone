## Releasing

Releases are automated. Every merge to `main` updates a release pull request that bumps the version and writes `CHANGELOG.md` from the conventional-commit subjects since the last release. Merging that pull request tags the version and creates the GitHub release.

The same run then publishes `@shadowclone/cli` to npm, behind the `npm` environment, so it waits for a maintainer to approve it from the Actions tab. That approval is the last gate before anything reaches the registry.

Commit subjects decide the version. A `feat:` subject bumps the minor, `fix:` bumps the patch, and anything with a `!` bumps the major. `chore:`, `ci:`, `test:`, and `refactor:` do not appear in the changelog.

One package ships. It carries the bundled CLI and depends on `bun`, which resolves its own platform binary through npm, so a machine with only Node can install and run it.

Publishing authenticates through trusted publishing, which exchanges a GitHub OIDC token for a short-lived npm credential and needs no stored secret. npm cannot configure a trusted publisher for a package that does not exist, so the first publish uses an `NPM_TOKEN` secret. After that, add `theonly1me/shadowclone` and `release.yml` as the trusted publisher and delete the secret. The npm CLI prefers OIDC when it is available and falls back to the token when it is not, so the workflow is the same either way.

# Contributing

Thanks for looking. This is an early project, so the surface area is small and the conventions are strict. Both of those make review fast, which is the whole point.

## Setup

Development uses [Bun](https://bun.sh). For anything that calls a model, at least one of `claude`, `codex`, or `cursor-agent` must be installed and logged in. No separate API key is required.

```bash
bun install
bun run check
```

`bun run cli init` writes the opt-in config. `bun run cli learn` ingests enabled sources and reports aggregate behavior without changing the profile or making a network call. `bun run cli learn --deep` is the separate, consented path that writes mined rules through a selected authenticated agent CLI. `bun run cli run "<task>"` explicitly approves one local worktree, branch, and commit for that task.

## The gate

Run this before you open a PR. It is what CI runs, on Linux and macOS.

```bash
bun run check        # bun run typecheck && bun run lint && bun test
```

`bun run lint` is two layers. Biome carries the TypeScript rules, including a plugin that reports any `as` cast other than `as const`. `scripts/conventions.ts` carries the three rules Biome has no rule for: files stay under 200 lines, `.ts` files hold no comments, and nothing anywhere holds an em-dash. Both print the file and line, and neither has a suppression comment you are allowed to reach for.

## Conventions

The conventions live in `.claude/skills/clean-code/SKILL.md`. Read it before your first PR.

The ones people trip on:

- **No `any`, no non-null `!`, no `as` casts.** Only `as const`. If the type system is fighting you, destructure and narrow instead of asserting.
- **Zero comments.** Not few. Zero. If code needs explaining, rename something, extract a named function, put the state in the type, or write a test that encodes the rule. The reasoning goes in the PR description, where it gets read.
- **Full words in names.** `statement` not `stmt`, `index` not `i`. Never shadow an import with a local name.
- **Two or more arguments take an options object.** `getRecentShellHistory({ lineCount, historyPaths })`.
- **Files stay under 200 lines,** tests included. Plan a folder module before writing a larger change.
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
- Resolve captured text through `resolveRedacted` before building learning input.
- Preserve the ingest cursor when the source has not changed.
- Add adapter tests covering redaction wiring and an empty source.
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
2. **Learning capture passes `redactSecrets` through `resolveRedacted`.** Do not bypass the gate or duplicate it downstream. Authorized coding and evaluation send code to the selected provider under the separate boundary documented in `docs/architecture/05-privacy.md`.
3. **A test proves the wiring, not just the function.** `src/redact/index.test.ts` proving a pattern works says nothing about whether an adapter keeps text behind the resolver. Every adapter under `src/observe/adapters/` ships a wiring test with a fixture transcript holding a planted secret.
4. **No raw capture in a log line, an error message, or a committed test fixture.** Public fixtures must be synthetic, and evaluation write-ups must be reviewed summaries, not raw receipts.
5. **Tool results, file contents, and thinking blocks are never distilled.** Excluded by category, not redacted. `docs/architecture/07-enterprise.md` has the list and the reason.
6. **Repository and owner guidance stays scoped.** Global guidance requires explicit, globally scoped evidence or a user-directed change.

If you are unsure whether your change touches egress, it touches egress. Say so in the PR and let the reviewer decide.

## Reporting a redaction gap

If you find a string that gets past `src/redact/`, that is the most valuable bug report this project can get. Open an issue describing the **shape** of the string, not the string itself. "A GitLab personal access token starting `glpat-` is not matched" is enough to write the pattern and the test.

`SECURITY.md` covers the reports that go through private reporting instead.
