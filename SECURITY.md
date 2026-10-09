# Security

Report failures in consent, redaction, repository scope, file ownership, or execution controls in private. Use the **Report a vulnerability** button on the **Security** tab of this repository. Do not attach sensitive evidence to a public issue.

## What to report

- Source content that Shadowclone read without consent, or sent outside an authorized provider request.
- Secrets, excluded tool results, or private source material that learning, logs, errors, or published files exposed.
- Repository or organization guidance that applied outside its permitted scope.
- Actions that Shadowclone took without the required authorization.
- User configuration that overrode managed policy, or writes and deletions that bypassed ownership checks.

Include a synthetic reproduction and the affected version when you can. There is no bounty and no guaranteed response time.

## Redaction gaps

You can report a missing token pattern in public if a synthetic description is enough. For example, give a token prefix and its length. Use private reporting for a real exposure, or for any report that needs sensitive material.

## Supported releases

Before version 1.0, security fixes target the newest release. Published npm packages include provenance. Check it against this repository and its [release workflow](.github/workflows/release.yml).

See [data handling](docs/data-handling.md) for what Shadowclone reads, sends, stores, and removes.
