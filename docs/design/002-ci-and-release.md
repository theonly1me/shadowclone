# CI and release checks

The original release design used compiled archives. The project now publishes through Release Please and npm; see [releasing](../../CONTRIBUTING.md#releasing).

## Problem

Local type checks and tests did not prevent unchecked changes from merging. Several repository conventions also depended entirely on review.

## Decision

Use `bun run check` as the shared local and CI gate: typecheck, lint, then tests. Run tests on Linux and macOS because filesystem paths, policy locations, and process behavior differ.

Use Biome for TypeScript linting, a GritQL rule for type assertions, and a tested repository checker for file length, comments, and prohibited prose characters. Keep the runtime version pinned in `package.json` and GitHub Actions pinned to commit digests. Grant workflows only the permissions their jobs need.

Release checks verify the package version, exercise the built CLI, and attach provenance to published output. Provenance identifies the source and build process; it does not prove the program is safe or the build byte-for-byte reproducible.

## Tradeoffs

The initial choice of compiled archives avoided a runtime installation. Packaging later moved to npm, so archive download, signing, and first-release instructions are no longer installation guidance.

Biome covered the required rules with a small toolchain. Formatting was kept separate because enabling it would produce an unrelated repository-wide rewrite. Custom checks need tests for both violations and valid input, including strings that resemble comments.

## Verification

Exercise each custom rule with a failing fixture and a clean fixture. Ensure the walker finds expected files and ignores generated directories. Check workflow syntax, version mismatch failures, package contents, and the built CLI. The workflow files are the source of truth for publishing steps.

## Release test timing repair

The `v0.0.11` release gate exposed two timing-dependent tests, although that version was later published. The deadline test allowed 200 ms for setup and receipt writes, then assumed every judge arm had saved its first vote. On a slower Linux runner, the timeout was recorded correctly but that assumption failed. A maintenance test exceeded its 30-second test limit on macOS while exercising repeated Git and receipt checks.

Seed the deadline test with valid saved votes, wait for a judge call that ignores cancellation, and verify that the hard deadline preserves the receipt and resumes the remaining work. Give the deadline and maintenance tests enough time for runner variation. Run focused tests and the full check gate so future releases are not blocked by these tests.

## Maintainer source scan

The catalog scans Shadowclone independently, but a source change can fail that gate after passing the repository's typecheck, lint, and tests. Run the pinned HOL scanner action on pushes and pull requests with a score floor of 80 and no high-severity findings. Give it read-only repository access, keep checkout credentials out of the workspace, and leave PR comments, online probing, and SARIF upload disabled. Verify the workflow syntax, run the scanner locally against the repository, and run `bun run check` before publishing the workflow.
