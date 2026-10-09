# Contributing

## Development setup

Install [Bun](https://bun.sh) 1.4.2, as `package.json` declares. Then run:

```bash
bun install
bun run check
```

Use `bun run cli` to run Shadowclone from the checkout. A command that calls a model needs an installed and authenticated `claude`, `codex`, or `cursor-agent` CLI. Ordinary tests use synthetic fixtures and need no account.

On Linux, install `bubblewrap` and `socat` before you run the tests. The sandbox checks of Claude need them.

`bun run cli init` changes your local setup. Use isolated test paths when you test installation, learning, or removal code.

## Repository layout

The repository is a Bun workspace. Each package in `packages/` is `@shadowclone/<name>` and has its own `AGENTS.md`. `evals/` and `tooling/` are private workspaces. The [architecture](docs/architecture/README.md) shows the package graph.

- Import another package only by its name and its declared subpaths.
- `tooling/src/boundaries/packages.ts` holds the allowed dependencies. `bun run lint` checks every import against it.
- Turborepo runs `typecheck`, `test`, `build`, and `stage` for each package, and it caches `typecheck` and `test`.

## Making a change

Describe the problem and the approach in `docs/` before you implement. For a new product or architecture decision, use the [design template](docs/design/template.md). Add the record to the [index](docs/design/README.md).

Keep changes focused. Add tests for behavior that can regress. Run the affected tests while you work. Before you submit, run:

```bash
bun run check
```

This runs typecheck, lint, the knip unused-file check, and tests. CI also runs the tests on Linux and macOS. The [plugin security scan](.github/workflows/plugin-security-scan.yml) runs on pushes and pull requests. It needs a score of at least 80 and no high-severity finding.

## Add a package

1. Create `packages/<name>/`.
2. Add `package.json`. Set `name` to `@shadowclone/<name>`, `private` to `true`, and `type` to `module`. Set no version.
3. Add `exports` with `"."` for `./src/index.ts`. Add `./testing` or `./browser` only when other packages need them.
4. Add the `typecheck` script (`tsc --noEmit`) and the `test` script (`bun test`).
5. Add `tsconfig.json` that extends `../../tsconfig.base.json`, with `include` set to `["src"]`.
6. In `tooling/src/boundaries/packages.ts`, add the name to `packageNames`. Add a row to `allowedDependencies` that lists only the packages it may import.
7. Record each new dependency edge in a design record.
8. Add `AGENTS.md` in the shape of any other package guide. Add `CLAUDE.md` that contains only `@AGENTS.md`.
9. Add a row for the package to the table in `docs/architecture/README.md`.
10. Run `bun install` and `bun run guides`. Then run `bun run check`.

## Code conventions

- Use complete names and an options object for functions with two or more arguments.
- Keep TypeScript files at 300 lines or fewer, including tests.
- Avoid `any`, non-null assertions, type assertions other than `as const`, and unhandled or voided promises.
- Write code without comments. Express intent in names, types, functions, and tests. Leave unrelated existing comments alone.
- Fix lint findings. Do not suppress rules.
- Format changed files with `bun run format <files>`. Check them with `bun run format:check <files>`.
- Do not use em dashes or en dashes.
- Keep each bundled skill in `skills/` at the quality bar of [design record 032](docs/design/032-bundled-skill-quality.md). `bun run lint` checks it with `tooling/src/skills.ts`.
- Each skill must pass `node skills/write-plain-english/scripts/check-ste.mjs`. `bun run lint` runs it for you.
- A skill that writes for the user sets `shadowclone-voice: "true"`. It contains the voice block from `packages/skills/src/skills/voiceBlock.ts`.
- After you change a file in `skills/`, run `bun run tooling/src/skillVersions.ts --record`. `shadowclone sync` replaces an installed copy only when its text matches a recorded version. Lint fails until you record the new version.

[AGENTS.md](AGENTS.md) is the entry point for coding assistants.

## Documentation

Write for someone who uses or changes the project. Explain the action or the decision that they must understand. Keep current guides aligned with the implementation. Put historical decisions in design records.

Write every Markdown file in ASD-STE100 Simplified Technical English at about 80% strictness, with the `write-plain-english` skill. `bun run lint` runs `tooling/src/prose.ts`. It reports plain English errors and broken relative links in every Markdown file except the excluded paths.

Keep each package `AGENTS.md` current. `bun run guides` rewrites the generated facts block of every guide. `bun run lint` fails when a guide is missing or its facts block is out of date.

Leave session approvals, expired deadlines, progress logs, and incidental test counts out of permanent docs. Link to an existing explanation. Do not repeat it. You can omit optional template sections.

## Pull requests

Use the [PR template](.github/pull_request_template.md). Keep the body under 250 words. Write one sentence for each change bullet, with at most seven bullets. Explain why in at most three sentences. Include the verification and any material limit. Remove unused sections.

Commit messages use one lowercase conventional-commit subject. Pull request titles use the same format. A squash merge uses the title as the commit subject on `main`. Release Please ignores commits that are not conventional. Do not add a co-author trailer. Do not force push reviewed work.

## Changes that involve user data

Read [data handling](docs/data-handling.md) and the [contributor data rules](.claude/skills/data-handling/SKILL.md) before you change capture, storage, model requests, or delegated actions.

Shipped guidance in `skills/`, `preferences/`, and `plugins/shadowclone/skills/` must hold no private material. `bun run lint` runs `tooling/src/privacy.ts`. It flags email addresses, machine paths, repository item references, unlisted URLs, gendered pronouns, and private terms.

To add a private term without writing it in the repository, run `bun run tooling/src/privacy.ts --hash "<term>"`. Add the printed hash to `tooling/src/privacyTerms.json`.

A new source needs an opt-in flag and an entry in the data-handling source list. Tests must use the real input path with synthetic sensitive values. Keep private source material, raw transcripts, and evaluation receipts out of the checkout and public reports.

For a redaction gap, describe the format with a synthetic example. Report exposures and other vulnerabilities privately, as [SECURITY.md](SECURITY.md) describes.

## Releasing

Release Please maintains a release PR from conventional commits on `main`. When you merge it, it creates the version tag and the GitHub release. After CI passes, a maintainer approves the `npm` environment in GitHub Actions. Then the workflow publishes `@shadowclone/cli` with provenance.

Use `feat:` for a minor version, `fix:` for a patch, and `!` for a breaking change. The [release workflow](.github/workflows/release.yml) defines publishing and retry behavior.
