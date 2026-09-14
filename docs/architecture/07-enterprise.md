# Organization boundaries

Written for the security reviewer who has to approve this. Every claim here can be checked against the source.

## The problem a personal tool creates at work

A profile learned from every repo you touch mixes employers, clients, and personal projects into one artifact. Loading that artifact into a session on a different repo moves one organization's derived data into another's.

"It runs on your own subscription" does not answer that. The subscription is not the boundary anyone cares about. The organization is.

Source scoping, input eligibility, and managed policy provide separate controls. Their implementation and limits need to be reviewed together.

## 1. Origin scoping

Every rule records the git remote origins it was learned from. The implementation uses normalized `host/owner` as the boundary. On GitHub that owner can be an organization or a personal account, and Shadowclone does not infer a legal employer or enterprise boundary. Compilation for a target repo includes only rules whose owner matches that repo, plus rules that have been promoted to global.

```
~/.shadowclone/profile/
  global/                       personal habits, safe everywhere
    identity.md
    workflow.md
  org/
    github.com--acme/           only ever compiled into acme repos
      engineering.md
      projects/platform.md
    github.com--example-personal/
      engineering.md
  .rejected
```

Reconciliation allows global scope only from assessed explicit global guidance. Repeated observations under two owners do not automatically promote a rule. Users can also record global preferences directly. Repository-specific learning remains in the exact project scope when that identity is available.

Demotion is always available and always wins. A rule in `global/` that the user moves back into an org directory stays there.

A repo with no git remote is treated as its own isolated origin, never as global. Absence of evidence is not evidence of safety.

Reading the remote is its own off-by-default source named `git-metadata`. Without that consent, every working directory is treated as an isolated origin. Transcript consent alone never causes shadowclone to inspect a repository.

## 2. Distillation allowlist

The stronger control is not redacting third-party data, it is never reading it.

Distillation input is restricted by category, and the list is short enough to audit.

**Eligible.** The user's own typed prompts. Plan, question, and denial events. Tool call metadata, meaning the tool name and a repo-relative path. Assistant text immediately preceding a correction event, bounded in length, because a rejected plan is meaningless without knowing what was rejected.

**Never eligible, at any setting.** The content of any `tool_result`. File contents from Read, Edit, or Write. Thinking blocks. Any result from an MCP data-access tool.

Tool results can contain production logs, database rows, credentials, third-party data, and other sensitive information that cannot be reliably identified through redaction alone. Shadowclone excludes tool-result payloads by category.

Pattern matching finds an API key in them and will not find a customer's email address. So they are never read.

**Every distillation batch has one origin and exact repository scope.** One organization's transcripts produce one organization's rules. Global rules, matching owner rules, and only the exact repository's project rules may enter reconciliation. Content from two organizations or sibling repositories is never in the same request. Existing rule, rejection, origin, repository, and evidence identities stay local behind opaque tokens.

## 3. Managed policy

An administrator can constrain or disable shadowclone fleet-wide without touching the user's home directory.

| Platform | Path |
| --- | --- |
| macOS | `/Library/Application Support/shadowclone/managed.json` |
| Linux | `/etc/shadowclone/managed.json` |

These paths require root to write, so a user cannot grant themselves more than policy allows.

```json
{
  "enabled": true,
  "allowedSources": ["claude-code"],
  "allowedEngines": ["claude-code", "openai-compatible"],
  "distillation": "local-only",
  "originScope": "strict",
  "blockedOrigins": ["github.com/acme/security-*"],
  "maxActionTier": "draft"
}
```

Managed policy is read before user config and every field is a ceiling. User config can be more restrictive and never less. `"enabled": false` is a hard stop that no user setting overrides. `"distillation": "local-only"` forbids hosted engines; the planned local endpoint engine is not yet implemented. `"maxActionTier": "draft"` removes push and pull request capability regardless of any repo allowlist.

Phase 3 implements the root ownership check, source and engine ceilings, distillation ceiling, hard stop, and blocked origin filtering. Phase 4 applies the action tier to unattended dispatch.

`shadowclone doctor` prints the active managed policy and where it was read from, so a user can see what applies to them and an admin can confirm it took effect.

## What to tell a security reviewer

The accurate claims, each of which can be checked against the source.

There is no shadowclone server, no shadowclone account, and no shadowclone API key. The project has nowhere to receive data.

Model requests use the selected authenticated agent CLI. That account and provider must be approved for the material being processed. Existing authentication is not permission to analyze every local transcript or repository, and Shadowclone adds a new workflow that a security reviewer should assess.

Derived state stays local. The profile is Markdown; the disposable index is SQLite, and other ledgers and receipts use structured files. `shadowclone forget --all` removes stored state and recorded integrations while preserving unrelated content and refusing conflicting edits.

Tool-result payloads are excluded from transcript learning. This is not a blanket guarantee about repository evaluation or dispatch: those workflows expose an explicitly chosen repository snapshot or worktree to the provider, and evaluation sends generated code to judges without redaction.

Owner-scoped and project-scoped rules are not compiled into a different matching scope. Explicit global guidance is shared by design. Remote ownership is a coarse technical identity, not a verified legal boundary.

An administrator can disable it entirely with a root-owned file.

## What is not claimed

Shadowclone does not guarantee anonymity or eliminate the risks of model processing. Original transcripts remain under their providers' control after uninstall. Administrators must evaluate source consent, global guidance, provider access, and local retention for their deployment.

The project does not claim regulatory compliance. That depends on the deployment and its agreements. This document describes controls and limitations for a reviewer to verify.
