# Organization boundaries

A personal agent environment can contain guidance from several employers, clients, and projects. Source consent, repository scope, and managed policy limit where that guidance can be used. Remote ownership is a technical identity, not proof of a legal organization boundary.

## Scope

Learning records carry their origin and scope. Project guidance is published only to its registered repository after identity verification. Organization guidance applies within a matching normalized remote owner. Global guidance requires explicit global evidence or a direct user instruction; repetition across owners does not promote it automatically.

Without `git-metadata` consent, each working directory remains isolated. Missing or ambiguous identity does not make guidance global. Learning requests keep project and owner evidence separated, with persistent identities hidden behind local prompt tokens.

## Eligible content

Learning uses user-authored steering and bounded supporting context. Tool-result payloads, tool-returned file contents, thinking blocks, and data-access results are excluded. Enabled transcript parsers may still encounter these records; exclusion describes what enters learning.

This does not cover every provider interaction. An authorized evaluation or delegated run exposes its workspace, and evaluation judges receive unredacted generated code. The [data-handling guide](../data-handling.md) explains each operation.

## Managed policy

Administrators can place a root-owned policy at:

| Platform | Location |
| --- | --- |
| macOS | `/Library/Application Support/shadowclone/managed.json` |
| Linux | `/etc/shadowclone/managed.json` |

```json
{
  "enabled": true,
  "allowedSources": ["claude-code"],
  "allowedEngines": ["claude-code"],
  "distillation": "allowed",
  "originScope": "strict",
  "blockedOrigins": ["github.com/example-team/restricted-*"],
  "maxActionTier": "draft"
}
```

User settings can narrow these permissions but cannot widen them. `enabled: false` disables Shadowclone. `local-only` prevents hosted learning; no local model runner is implemented. A `draft` action ceiling prevents remote publishing even when repository policy allows it.

`shadowclone doctor` reports the effective managed policy. Ownership checks protect the policy file from being replaced by ordinary user configuration. These controls govern this installation, not other programs running under the account.

## Deployment review

Review enabled sources, intended global guidance, approved providers, access to local state, and retention together. An existing provider subscription does not authorize sending every local repository or transcript through it.

Shadowclone has no hosted collection service. Evidence, skills, revisions, and receipts stay local except for the requests needed by authorized operations. Local files are not encrypted, and deleting them does not remove provider-retained data or backups.

The project does not claim anonymity or regulatory compliance. Confirm the implementation and provider agreements against the deployment’s requirements, and use [private security reporting](../../SECURITY.md) for failures.
