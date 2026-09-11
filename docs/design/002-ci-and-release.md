# CI and release

Status: the original standalone-archive proposal is superseded by the npm release implementation and [015](015-remediation-completion.md).

## Summary

Run type checking, lint, conventions, and tests on Linux and macOS. Publish the npm CLI through a checked GitHub Actions release workflow.

## Problem

A release can be announced before validation if release creation precedes the required gate. Public documentation must describe the artifacts the workflow actually produces.

## Prerequisites

Configured GitHub Actions and npm publishing permissions.

## Design

The reusable CI workflow runs before release preparation and package publication. Release preparation uses release-please. Publication checks the package version against the release tag, builds the CLI, and runs npm publication with provenance.

The package contains the launcher, built JavaScript, package-owned guidance, README, and license. Standalone platform archives, checksum manifests, and GitHub archive attestations are not produced by the current workflow.

## Files

| Path | Role |
| --- | --- |
| `.github/workflows/ci.yml` | Reusable checks |
| `.github/workflows/release.yml` | Checked release preparation and npm publication |
| `scripts/build.ts` | Build the package CLI |
| `scripts/conventions.ts` | Repository convention checks |

## Data handling

The workflow builds repository contents. It adds no transcript collection or telemetry. Published provenance describes the package build path, not a security certification.

## Alternatives

**Standalone archives.** The earlier proposal is not the current distribution path. Documentation no longer provides commands for artifacts that are absent.

## Accepted costs

Only the newest pre-1.0 release receives fixes. Provenance does not demonstrate that code is free of vulnerabilities.

## Testing

Run the repository gate and build, inspect package contents with a dry run, and validate workflow dependencies without publishing a release.

## Open questions

None.

## Decision record

The current distribution is the npm package. Required checks precede both release creation and package publication.
