# Check every change in CI and ship the CLI as a signed release

## Summary

Every push and pull request runs `bun run typecheck`, `bun run lint`, and `bun test` on Linux and macOS, where `lint` is Biome plus a repository checker for the three conventions Biome cannot express. A version tag runs the same gate and then publishes compiled binaries for four platforms, with checksums and a GitHub build provenance attestation, so shipping is a tag push rather than a sequence of local commands.

## Problem

Nothing checks a change today. `CONTRIBUTING.md` says `bun run typecheck` and `bun test` are "what CI will run", and there is no CI, so the gate holds only while whoever wrote the diff remembers to run it. Six stacked pull requests are open, and the tip of that stack is 107 source files and 82 tests that no machine has ever checked.

The conventions the project cares about most are the ones no tool checks. A lint pass over the tip of the stack finds `let fileStats;` in `src/observe/cursor.ts`, an implicit `any` that `tsc --noEmit` accepts because TypeScript widens it later. The 200 line file limit, the zero comment rule, and the em-dash ban are enforced by review alone, and review is where an assistant's diff is most likely to be trusted.

There is also no way to run shadowclone without cloning the repository. The design ships a CLI that people are asked to point at their own transcripts, and asking them to `git clone` and trust `bun run` is a worse trust story than a versioned archive whose provenance can be verified.

## Prerequisites

Bun 1.3 or later, pinned for CI by `packageManager` in `package.json`, which `oven-sh/setup-bun` reads. Without the pin, CI drifts to whatever Bun is newest, and the release binaries embed a runtime nobody chose.

`src/cli/index.ts`, which lands with phase 1. Without it `bun run build` stops with a message saying there is nothing to build, so no release can be cut from `main` as it stands.

Required status checks on `main`, set in repository settings. Without them CI reports but does not block.

## Design

The gate is one command, `bun run check`, which runs typecheck, lint, and tests in that order, fastest failure first. CI runs the same three commands rather than a CI-only script, so a green local run and a green pull request mean the same thing.

`.github/workflows/ci.yml` runs on pushes to `main`, on every pull request, and on `workflow_call`. The `check` job runs typecheck and lint once on Linux. The `test` job runs `bun test` on `ubuntu-latest` and `macos-latest`, because the product reads `~/.claude`, writes `~/.shadowclone`, and resolves managed policy per platform, and macOS is the primary target. Every action is pinned to a commit digest, and `permissions` is `contents: read`.

Linting is layered, and each layer owns what it is best at.

- `biome.json` turns on Biome's recommended rules with the formatter off, and raises `noExplicitAny`, `noImplicitAnyLet`, `noNonNullAssertion`, `noVoid`, and `noFloatingPromises` to errors. Those five are the project's TypeScript rules written as lint rules.
- `.biome/noTypeAssertion.grit` is a GritQL plugin that reports every `as` cast and permits `as const`, which is the one type-safety rule Biome has no rule for.
- `scripts/conventions.ts` walks the repository and reports files over 200 lines, comments in TypeScript, and em-dashes in source or prose. Comments are found with the TypeScript scanner rather than a regular expression, so `"https://bun.sh"` and `/a\/b/` are not mistaken for comments, and a suppression comment is caught by the rule that bans comments.

`.github/workflows/release.yml` runs on a `v*` tag and on `workflow_dispatch`. It calls `ci.yml` as its first job, refuses to continue when the tag does not match `version` in `package.json`, runs `bun run build`, runs the built Linux binary once, attests the archives, and publishes them with `gh release create --generate-notes`. A tag containing a hyphen becomes a prerelease. A `workflow_dispatch` run does everything except create the release, which is how the path gets exercised without spending a version number.

`scripts/build.ts` cross compiles `src/cli/index.ts` with `bun build --compile` for `darwin-arm64`, `darwin-x64`, `linux-x64`, and `linux-arm64`, names the binary `shadowclone` inside a per platform `tar.gz`, and writes `SHA256SUMS.txt` over the archives. Compression matters at these sizes: the Linux x64 binary is 104 MB and its archive is 39 MB. The same script produces the release artifacts locally, so anyone can rebuild what was published.

## Files

| Path | Change |
| --- | --- |
| `.github/workflows/ci.yml` | New. Typecheck and lint on Linux, tests on Linux and macOS. |
| `.github/workflows/release.yml` | New. Tag triggered gate, build, attestation, and release. |
| `.github/dependabot.yml` | New. Weekly grouped updates for actions and Bun dependencies. |
| `biome.json` | New. Recommended rules, formatter off, project rules raised to errors. |
| `.biome/noTypeAssertion.grit` | New. Reports `as` casts and permits `as const`. |
| `scripts/conventions.ts` | New. File length, comments, and em-dashes. |
| `scripts/conventions.test.ts` | New. One test per rule, plus a clean tree and a skipped directory. |
| `scripts/build.ts` | New. Four compiled targets, archives, and checksums. |
| `package.json` | `version`, `packageManager`, `engines`, the `check`, `lint`, and `build` scripts, and Biome as a dev dependency. |
| `SECURITY.md` | New. Private reporting, what counts, and how to verify a release. |
| `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` | The gate becomes `bun run check`, and `CONTRIBUTING.md` gains a releasing section. |

## Data handling

CI reads the repository and nothing else. No workflow reads a home directory, and none of them has a secret beyond the automatic `GITHUB_TOKEN`, which is `contents: read` everywhere except the job that creates a release.

The one new egress path is release publishing, which uploads build output derived from committed source. It carries nothing captured from a machine, so the redaction gate is not in this path and is untouched by this change. `redactSecrets` stays the only thing between captured text and the network.

The release binary runs on other people's machines, which is why it carries a provenance attestation. That is a claim about where the binary came from, not telemetry: nothing reports back, and the workflow adds no analytics, crash reporting, or update check.

## Alternatives

**Turn the formatter on now.** Biome's formatter rewrites 82 of the 107 files on the tip of the stack, and Prettier rewrites the same number, because neither one formatted this code originally. Landing that on `main` would conflict with all six open pull requests at once. The formatter is a separate change after the stack merges, which is why `biome.json` ships with `formatter.enabled: false`.

**ESLint with typescript-eslint.** It has the exact rule for banning `as` casts, and type aware rules the others lack. It also adds tens of transitive dependencies and a slow type aware pass to a repository that just removed every runtime dependency. Biome plus a nine line plugin covers the same rules at a fraction of the cost.

**oxlint.** As fast as Biome and it has `max-lines`, but no custom rule mechanism, so the `as` cast ban would have to be a grep. It is the second choice, not the wrong one.

**A secret scanner in CI.** `src/redact/index.test.ts` and the transcript fixtures plant fake secrets on purpose, which is exactly what the redaction tests are for. Gitleaks flags those, so the job would ship with an allowlist covering the files most worth scanning. GitHub's own secret scanning and push protection, enabled in settings, does this job without a workflow.

**Publish to npm.** The name `shadowclone` is taken on npm by an unrelated package, so this would ship as a scoped name nobody will guess, and the `bin` is a Bun script that Node cannot run. Compiled binaries need no runtime at all.

**Grep the source for `bypassPermissions` and `--dangerously-skip-permissions`.** `src/engine/index.test.ts` already asserts neither flag reaches a provider's argument list. A text check would flag that test, and a test that runs the real argument builder is stronger evidence than a grep.

**A hand written `CHANGELOG.md`.** Generated notes from merged pull request titles cost nothing and stay accurate. A release note that has to say a capture source was added can be edited into the release body, which is where people read it.

## Accepted costs

`noFloatingPromises` is a nursery rule, so a Biome upgrade can change what it reports. Biome is pinned to an exact version and Dependabot proposes upgrades as pull requests that run the gate, so the change shows up as a red check rather than a surprise.

The release path cannot run end to end until phase 1 lands `src/cli/index.ts`. It was verified against the tip of the stack instead, and `bun run build` fails on `main` with a message that says why.

The archives are not byte reproducible, since `tar` and `gzip` record a modification time. Provenance attestation and published checksums are the verification story, not rebuilding to the same bytes.

`scripts/conventions.ts` enforces zero comments across the whole repository, which is stricter than the add none rule in `.claude/skills/clean-code/SKILL.md`. It is green today because there are no comments in any TypeScript file, and a contributor who needs one has to argue for it in review rather than slip it in.

The binaries are unsigned, so macOS quarantines a downloaded copy until the user removes the attribute. Signing and notarization need an Apple Developer account.

A release is about 330 MB of archives, since every binary embeds the Bun runtime. Release assets do not count against repository storage.

CI is red on two of the open pull requests until two one line fixes land: the implicit `any` in `src/observe/cursor.ts` from `feat/phase-one-observe-index`, and an optional chain in `src/distill/checkpoint.ts` from `feat/phase-three-live-clone`.

## Testing

`scripts/conventions.test.ts` has one test per rule, a clean tree that must report nothing, and a tree whose only violations sit in `node_modules` and `dist`. The checker returns the number of files it read, and the clean tree test asserts that count, so a walker that silently stops finding files fails instead of passing.

The mutation proof for each rule, run before this landed: flipping the file length comparison, dropping `SingleLineCommentTrivia` from the scanner, pointing the em-dash check at an en dash, and removing the skipped directory filter each turn the suite red, and restoring each one turns it green.

The gate was run inside `oven/bun:1.3.3` on `linux/amd64` against this branch, and against the tip of the stack, which is where the two lint findings above come from. `actionlint` checked both workflows, and the publish step's shell body was run with `gh` stubbed to confirm the notes interpolate, a hyphenated tag becomes a prerelease, and a mismatched tag exits non-zero. `scripts/build.ts` was run against the tip of the stack, producing four archives, and the darwin-arm64 archive extracted to a binary that prints its usage line.

## Open questions

**Which formatter, and when.** Biome's formatter is already in the toolchain and Prettier is the style the code nearly follows. The answer decides one reformatting commit after the stack merges, and whether `bun run lint` grows a format check.

**Whether to publish a scoped npm package as well.** `bunx @scope/shadowclone` is a lower friction first run than downloading an archive, for people who already have Bun. The answer decides whether the release workflow gains a publish step and an npm token.

**Which checks become required on `main`.** Requiring `check` and both `test` jobs blocks merges on a red run, and it also blocks the stack until the two lint findings are fixed. The answer decides the order those two things happen in.

**Whether release binaries get signed.** Notarized macOS binaries remove the quarantine step and cost an Apple Developer account plus secrets in the release workflow. The answer decides whether the release job ever holds a signing key.

## Decision record

CI runs the same commands a contributor runs, because a gate that only exists in a workflow file is a second definition of correct.

The gate is `bun run check`, because two commands to remember became three once linting existed.

Tests run on Linux and macOS, because the product's paths and managed policy differ per platform and macOS is the primary target.

Biome is the linter, because it covers the project's type safety rules in one pinned dependency, and its GritQL plugin covers the `as` cast ban that has no built in rule.

The formatter stays off, because turning it on rewrites 82 files and would conflict with all six open pull requests.

The three conventions Biome cannot express live in `scripts/conventions.ts` with a test per rule, because a checker nobody tests is a checker that can pass vacuously.

Comments are found with the TypeScript scanner, because a regular expression cannot tell a comment from a URL in a string.

Releases are compiled binaries in per platform archives, because the CLI has no runtime dependency once compiled and the npm name is taken.

The tag must match `package.json`, because a release whose version is a guess cannot be reasoned about afterwards.

Every action is pinned to a commit digest and Dependabot proposes the bumps, because a tag can be moved and this repository ships a binary that reads people's transcripts.

The release workflow calls `ci.yml` rather than repeating its steps, because a release that skips a check is the one case where skipping matters most.
