# Security

Shadowclone handles potentially sensitive local transcripts and derived profiles. Its protections cover specific consent, materialization, storage, and execution boundaries. They do not guarantee the absence of vulnerabilities. See [Data handling](docs/data-handling.md) for the public statement.

## Reporting

Use the repository **Security** tab, then **Report a vulnerability**, for unintended disclosure, unsafe execution, unauthorized writes or deletion, or policy bypass. Keep exploit details private until a fix is available. There is no bounty or guaranteed response time.

Useful reports include a synthetic reproduction, affected version and platform, expected boundary, and observed behavior. Do not post real credentials, transcripts, private evaluation state, or identifying local paths. A redaction pattern suggestion can be a public issue if it contains only a synthetic example and does not disclose an exploitable private detail.

## Boundaries

- Source contents require source consent. Onboarding may perform a boolean presence check before asking. Git metadata and instruction/context import have separate consent.
- Learning excludes tool-result payloads and thinking blocks. Pattern redaction of eligible text is incomplete by nature; sensitive prose may remain.
- Compilation selects global guidance and matching remote-owner/repository scope. Remote ownership is a technical identifier, not proof of a legal organization or employer boundary.
- Invoking headless `run` approves its local worktree, branch, and commit. Push and PR actions require matching repository ceilings and explicit grants for that run. PR replies require a named PR number. The host agent's permissions govern live installed clones.
- Unattended execution and independent verification use supported OS isolation. Verification has no provider credentials or network. Provider runtime access remains a separate trust decision.
- Managed policy must be a bounded regular file under a trusted directory chain. User configuration cannot widen its ceilings.
- Generated private state uses restrictive filesystem modes, not encryption. Same-account malware, administrators, providers, and external backups are outside that protection.

## Releases

Before 1.0, only the newest release receives fixes. The release workflow runs required checks before release creation and npm publication. It publishes `@shadowclone/cli` with npm provenance through GitHub Actions.

The current release process does not produce standalone platform archives, a `SHA256SUMS.txt` file, or downloadable GitHub build-attestation bundles. There are no archive-verification commands for those artifacts. Inspect the npm package's provenance and the matching workflow run when assessing a published version. Provenance identifies the build path; it does not certify the package's security.
