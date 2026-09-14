# Security

Shadowclone processes consented coding sessions and applies derived guidance. Report failures in consent, redaction, scope, or execution controls privately.

## Reporting

Use private reporting on this repository: **Security**, then **Report a vulnerability**. That keeps the details out of public issues until there is a fix. There is no bounty and no response time promise, since this is a side project.

Do not open a public issue for anything in the list below.

## What counts

- Raw captured secrets or excluded tool results reaching learning, logs, errors, or committed fixtures; or any data reaching a provider outside an authorized execution boundary.
- Source contents read without consent, or pre-consent discovery exceeding the bounded onboarding presence check documented in `docs/architecture/01-capture.md`.
- A rule learned in one organization's repository compiling into a session on another organization's repository.
- Anything that sends, posts, commits, pushes, deletes, or spends without approval for that specific action.
- User configuration widening a limit that root owned managed policy set.

## Redaction gaps

A string that gets past redaction is a redaction gap, and it belongs in a public issue describing the **shape** of the string, never the string itself. `CONTRIBUTING.md` has the section on what that report looks like. Use private reporting when the report cannot be written without the string, or when the gap is one of the failures listed above.

## Releases

Before 1.0, only the newest release gets fixes.

The current release workflow publishes `@shadowclone/cli` to npm with provenance after CI and maintainer approval. Check the package's provenance against this repository and `.github/workflows/release.yml`. See [Contributing](CONTRIBUTING.md#releasing) for the release process.
