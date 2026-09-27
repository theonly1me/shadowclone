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
