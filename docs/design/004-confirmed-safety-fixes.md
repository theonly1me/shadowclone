# Correcting safety defects

This record covers five confirmed defects in repository scope, redaction, and execution.

## Decisions

| Defect | Correction |
| --- | --- |
| Repository policy used a checkout directory name, which could differ from the remote repository | Resolve policy against the canonical repository identity; preserve local isolation when remote identity is unavailable |
| Redaction rules retained characters from the secret-bearing match | Preserve only explicitly public prefixes, with fixtures proving secret characters cannot survive |
| Provider availability probes could wait indefinitely | Bound probe time and terminate timed-out processes |
| Learning could install an integration into an arbitrary working directory | Resolve and validate the intended repository before installation |
| The dispatch clean-exit requirement was unreachable through configuration | Make the configured requirement affect dispatch acceptance |

## Verification

Each regression test must reach the original defect through the affected public path. Use synthetic remote identities and secrets. Exercise process cleanup after a timed-out probe, installation outside a valid repository, and both clean-exit policy settings.

These fixes did not introduce a capture source or broaden action authority. Later [execution and storage remediation](015-remediation-completion.md) tightened the surrounding boundaries.
