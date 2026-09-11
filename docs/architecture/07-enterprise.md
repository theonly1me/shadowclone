# Repository boundaries and managed policy

Shadowclone scopes derived guidance by normalized remote identity. The [data-handling statement](../data-handling.md) describes what is stored and sent. This document makes no compliance certification or representation about any organization using the project.

## Origin scope

A remote identity includes its host, port when specified, full owner namespace, and repository. Filesystem scope names include a digest so punctuation and nested namespaces do not collide. Compilation selects global guidance, matching owner guidance, and the exact repository profile.

Remote owners are technical identifiers. They do not establish legal employers or enterprise boundaries. Global guidance is intentionally available across repositories; users must review what they place there. Automatic promotion based only on appearances across two owners is not implemented.

Git discovery requires `git-metadata` consent. Disabled metadata keeps working directories isolated and does not read their remotes. Observed bindings are associated with a source session and working directory. They describe what was observed, not proof of an earlier historical remote. Unknown or ambiguous scope must not automatically pool guidance.

## Eligible content

Learning excludes transcript tool-result payloads and thinking blocks. This reduces exposure but does not identify every kind of sensitive information within user prompts or assistant correction context. Existing guidance and rejection text also enter reconciliation after materialization and pattern redaction.

Batches select matching repository scope and use opaque prompt-local identities. Pattern redaction and scope selection are specific controls, not a guarantee that all confidential content has been removed.

## Managed policy

| Platform | Managed file |
| --- | --- |
| macOS | `/Library/Application Support/shadowclone/managed.json` |
| Linux | `/etc/shadowclone/managed.json` |

The file and its trusted parent chain must satisfy ownership and mode checks. Invalid policy fails closed. For example:

```json
{
  "enabled": true,
  "allowedSources": ["claude-code"],
  "allowedEngines": ["claude-code"],
  "distillation": "allowed",
  "originScope": "strict",
  "blockedOrigins": ["github.com/example/restricted-*"],
  "maxActionTier": "draft"
}
```

User configuration can narrow these ceilings. `enabled: false` disables this installation. `maxActionTier: draft` removes remote actions. `distillation: local-only` prevents hosted distillation; no local engine is currently implemented. `doctor` reports the applicable policy and supported provider capabilities.

Policy does not control unrelated tools or software the same user can install. Provider requests still use the chosen provider account and its terms. Introducing this tool changes which derived material may be sent; an existing subscription does not remove the need to assess that use.

Unbound sessions predating creation of the current index remain isolated. Existing bindings survive schema migrations; removing the index loses that observed provenance. Current remote state is not evidence of an unknown historical owner.
