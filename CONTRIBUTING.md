# Contributing

## Development setup

Install [Bun](https://bun.sh) 1.4.2, as declared in `package.json`, then run:

```bash
bun install
bun run check
```

Use `bun run cli` to run Shadowclone from the checkout. Commands that call a model need an installed, authenticated `claude`, `codex`, or `cursor-agent` CLI. Ordinary tests use synthetic fixtures and do not need an account.

On Linux, install `bubblewrap` and `socat` before running the tests so Claude's sandbox prerequisite checks can pass.

`bun run cli init` changes your local setup. Use isolated test paths when exercising installation, learning, or removal code.

## Making a change

Describe the problem and approach in `docs/` before implementation. For a new product or architecture decision, use the [design template](docs/design/template.md) and add the record to the [index](docs/design/README.md).

Keep changes focused. Add tests for behavior that can regress, and run the affected tests while working. Before submitting, run:

```bash
bun run check
```

This runs typecheck, lint, the knip unused-file check, and tests. CI also runs the tests on Linux and macOS. The [plugin security scan](.github/workflows/plugin-security-scan.yml) runs on pushes and pull requests and requires a score of at least 80 with no high-severity findings.

## Code conventions

- Use complete names and an options object for functions with two or more arguments.
- Keep TypeScript files at most 300 lines, including tests.
- Avoid `any`, non-null assertions, type assertions other than `as const`, and unhandled or voided promises.
- Write code without comments. Express intent in names, types, functions, and tests. Leave unrelated existing comments alone.
- Fix lint findings without suppressing rules.
- Use plain prose and ordinary punctuation. Do not use em dashes.

The repository [clean-code skill](.claude/skills/clean-code/SKILL.md) gives the full conventions. [AGENTS.md](AGENTS.md) is the entry point for coding assistants.

## Documentation

Write for someone using or changing the project. Explain the action or decision they need to understand. Keep current guides aligned with the implementation and put historical decisions in design records.

Leave session approvals, expired deadlines, progress logs, and incidental test counts out of permanent docs. Link to an existing explanation instead of repeating it. Optional template sections can be omitted.

## Pull requests

Use the [PR template](.github/pull_request_template.md). Keep the body under 250 words, with one sentence per change bullet, at most seven bullets, and at most three sentences explaining why. Include verification and any material limitation. Remove unused sections.

Commit messages use a single lowercase conventional-commit subject. Pull request titles use the same format, because a squash merge uses the title as the commit subject on `main` and Release Please ignores commits that are not conventional. Do not add a co-author trailer or force push reviewed work.

## Changes involving user data

Read [data handling](docs/data-handling.md) and the [contributor data rules](.claude/skills/data-handling/SKILL.md) before changing capture, storage, model requests, or delegated actions.

Shipped guidance in `skills/`, `preferences/`, and `plugins/shadowclone/skills/` must hold no private material. `bun run lint` runs `scripts/privacy.ts`, which flags email addresses, machine paths, repository item references, unlisted URLs, gendered pronouns, and private terms. To add a private term without writing it in the repository, run `bun run scripts/privacy.ts --hash "<term>"` and add the printed hash to `scripts/privacyTerms.json`.

New sources need an opt-in flag and an entry in the data-handling source list. Tests must exercise the real input path with synthetic sensitive values. Keep private source material, raw transcripts, and evaluation receipts out of the checkout and public reports.

For a redaction gap, describe the format using a synthetic example. Report exposures and other vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Releasing

Release Please maintains a release PR from conventional commits on `main`. Merging it creates the version tag and GitHub release. After CI passes, a maintainer approves the `npm` environment in GitHub Actions to publish `@shadowclone/cli` with provenance.

Use `feat:` for a minor version, `fix:` for a patch, and `!` for a breaking change. The [release workflow](.github/workflows/release.yml) defines publishing and retry behavior.
