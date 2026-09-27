# Security

Report failures in consent, redaction, repository scope, file ownership, or execution controls privately through this repository’s **Security → Report a vulnerability** page. Do not attach sensitive evidence to a public issue.

## What to report

- Source content read without consent or sent outside an authorized provider request.
- Secrets, excluded tool results, or private source material exposed through learning, logs, errors, or published artifacts.
- Repository or organization guidance applied outside its permitted scope.
- Actions performed without the required authorization.
- User configuration overriding managed policy, or writes and deletion bypassing ownership checks.

Include a synthetic reproduction and the affected version when possible. There is no bounty or guaranteed response time.

## Redaction gaps

A missing token pattern can be reported publicly when a synthetic description is sufficient, for example a token prefix and its length. Use private reporting for an actual exposure or any report that needs sensitive material to explain it.

## Supported releases

Before 1.0, security fixes target the newest release. Published npm packages include provenance; check it against this repository and its [release workflow](.github/workflows/release.yml).

See [data handling](docs/data-handling.md) for what Shadowclone reads, sends, stores, and removes.
