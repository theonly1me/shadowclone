# Enterprise controls

A personal agent environment can hold guidance from several employers, clients, and projects. Source consent, repository scope, and managed policy limit where that guidance applies. Remote ownership is a technical identity. It does not prove a legal organization boundary.

## Scope

Learning records carry their origin and scope.

- **Project guidance** goes only to its registered repository, after Shadowclone verifies the identity of the repository.
- **Organization guidance** applies inside a matching normalized remote owner.
- **Global guidance** needs explicit global evidence or a direct instruction from you. Repetition across owners does not promote guidance to global.

Without `git-metadata` consent, each working directory stays isolated. Missing or unclear identity does not make guidance global. Learning requests keep project evidence and owner evidence apart. Local prompt tokens hide the persistent identities.

## Eligible content

Learning uses steering that you wrote and bounded supporting context. It excludes tool-result payloads, tool-returned file contents, thinking blocks, and data-access results. An enabled transcript parser can still meet these records. The exclusion describes what enters learning.

This does not cover every provider interaction. An authorized evaluation exposes its workspace, and evaluation judges receive generated code without redaction. The [data-handling guide](../data-handling.md) explains each operation.

## Managed policy

An administrator can place a policy file that root owns:

| Platform | Location                                                |
| -------- | ------------------------------------------------------- |
| macOS    | `/Library/Application Support/shadowclone/managed.json` |
| Linux    | `/etc/shadowclone/managed.json`                         |

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

User settings can narrow these permissions and cannot widen them.

- `enabled: false` turns Shadowclone off.
- `local-only` prevents learning with a hosted model. Shadowclone has no local model runner.
- A `draft` action ceiling prevents remote publishing, even when repository policy allows it.

`shadowclone doctor` reports the effective managed policy. Ownership checks protect the policy file from a replacement by ordinary user configuration. These controls govern this installation. They do not govern other programs that run under the same account.

## Deployment review

Review these items together: the enabled sources, the intended global guidance, the approved providers, access to the local state, and retention. Provider access does not authorize you to send every local repository or transcript through that provider.

Shadowclone has no hosted collection service. Evidence, skills, revisions, and receipts stay on your machine, except for the requests that authorized operations need. Shadowclone does not encrypt local files. Deleting them does not remove data that a provider or a backup keeps.

The project does not claim anonymity or regulatory compliance. Check the implementation and the provider agreements against the requirements of your deployment. Use [private security reporting](../../SECURITY.md) for failures.
