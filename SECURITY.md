# Security

shadowclone reads the AI coding sessions on your disk, so a bug here leaks source code, hostnames, or credentials that belong to you or your employer. A report about that is the most valuable thing this project can receive.

## Reporting

Use private reporting on this repository: **Security**, then **Report a vulnerability**. That keeps the details out of public issues until there is a fix. There is no bounty and no response time promise, since this is a side project.

Do not open a public issue for anything in the list below.

## What counts

- A secret, a file's contents, or a tool result reaching a model, a log line, an error message, or a committed fixture.
- A capture source that gets read without the config flag naming it, including reading a path only to learn whether it exists.
- A rule learned in one organization's repository compiling into a session on another organization's repository.
- Anything that sends, posts, commits, pushes, deletes, or spends without approval for that specific action.
- User configuration widening a limit that root owned managed policy set.

## Redaction gaps

A string that gets past redaction is a redaction gap, and it belongs in a public issue describing the **shape** of the string, never the string itself. `CONTRIBUTING.md` has the section on what that report looks like. Use private reporting when the report cannot be written without the string, or when the gap is one of the failures listed above.

## Releases

Before 1.0, only the newest release gets fixes.

Release archives are built by `.github/workflows/release.yml` from a tagged commit and carry a build provenance attestation, so a download can be checked against the workflow and commit that produced it:

```bash
gh attestation verify shadowclone-darwin-arm64.tar.gz --repo theonly1me/shadowclone
shasum -a 256 -c SHA256SUMS.txt
```
