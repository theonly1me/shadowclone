# Organization boundaries

Written for the security reviewer who has to approve this. Every claim here can be checked against the source.

## The problem a personal tool creates at work

A profile learned from every repo you touch mixes employers, clients, and personal projects into one artifact. Loading that artifact into a session on a different repo moves one organization's derived data into another's.

"It runs on your own subscription" does not answer that. The subscription is not the boundary anyone cares about. The organization is.

Three mechanisms address it, and they are independent, so defeating one does not defeat the others.

## 1. Origin scoping

Every rule records the git remote origins it was learned from. Compilation for a target repo includes only rules whose origin matches that repo's organization, plus rules that have been promoted to global.

```
~/.shadowclone/profile/
  global/                       personal habits, safe everywhere
    identity.md
    workflow.md
  org/
    github.com--acme/           only ever compiled into acme repos
      engineering.md
      projects/platform.md
    github.com--atchyut/
      engineering.md
  .rejected
```

Promotion to `global/` happens two ways. A rule observed in **two or more distinct organizations** promotes automatically, because a habit that survives across employers is the person's, not the employer's. Anything else requires the user to promote it by hand, one rule at a time.

Demotion is always available and always wins. A rule in `global/` that the user moves back into an org directory stays there.

A repo with no git remote is treated as its own isolated origin, never as global. Absence of evidence is not evidence of safety.

Reading the remote is its own off-by-default source named `git-metadata`. Without that consent, every working directory is treated as an isolated origin. Transcript consent alone never causes shadowclone to inspect a repository.

## 2. Distillation allowlist

The stronger control is not redacting third-party data, it is never reading it.

Distillation input is restricted by category, and the list is short enough to audit.

**Eligible.** The user's own typed prompts. Plan, question, and denial events. Tool call metadata, meaning the tool name and a repo-relative path. Assistant text immediately preceding a correction event, bounded in length, because a rejected plan is meaningless without knowing what was rejected.

**Never eligible, at any setting.** The content of any `tool_result`. File contents from Read, Edit, or Write. Thinking blocks. Any result from an MCP data-access tool.

That last exclusion is why this is a category rule rather than a redaction rule. The measured corpus holds 328 data-access calls: 194 Loki log queries, 111 Postgres queries, and 23 actor log queries. Those results are production log lines and database rows belonging to customers.

Pattern matching finds an API key in them and will not find a customer's email address. So they are never read.

**Every distillation batch is single origin.** One organization's transcripts produce one organization's rules. Content from two organizations is never in the same request.

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

Managed policy is read before user config and every field is a ceiling rather than a default. User config can be more restrictive and never less. `"enabled": false` is a hard stop that no user setting overrides. `"distillation": "local-only"` permits the Ollama engine and forbids every hosted one. `"maxActionTier": "draft"` removes push and pull request capability regardless of any repo allowlist.

Phase 3 implements the root ownership check, source and engine ceilings, distillation ceiling, hard stop, and blocked origin filtering. Phase 4 applies the action tier to unattended dispatch.

`shadowclone doctor` prints the active managed policy and where it was read from, so a user can see what applies to them and an admin can confirm it took effect.

## What to tell a security reviewer

The accurate claims, each of which can be checked against the source.

There is no shadowclone server, no shadowclone account, and no shadowclone API key. The project has nowhere to receive data.

Model requests go to the agent CLI the user has already installed and authenticated, on their own account and their organization's existing plan. Shadowclone introduces no new vendor, no new contract, and no new trust boundary.

Everything stored is local plain text under `~/.shadowclone/`, readable in an editor and removable with `shadowclone forget --all`.

Third-party data in tool results is never read, so it is never sent anywhere by this tool.

One organization's derived rules are never injected into another organization's session.

An administrator can disable it entirely with a root-owned file.

## What is not claimed

Shadowclone does not make a machine more private than it already is, and it is designed not to make it less private. The transcripts it reads exist whether or not it is installed, written by tools the organization already approved. Uninstalling shadowclone does not remove them.

It cannot make an organization compliant with anything. Compliance is a property of a deployment and a contract. What this design offers is a system that is cheap to audit and easy to constrain, which is what a reviewer actually needs in order to say yes.
