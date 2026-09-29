# Repository setup

Set up shared instructions, skills, and checks for the current repository:

```bash
shadowclone init --repo
```

Setup asks to read project manifests, detects checks, and previews shared instructions and workflow skills. It asks separately before including personal preferences in files teammates may see. Review and commit the files you want to share.

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Shared instructions, selected skills, and verification commands |
| `CLAUDE.md` | Import of the shared instructions |
| `.agents/skills/` and `.claude/skills/` | Repository workflows and selected personal skills |
| `.shadowclone/harness.json` | Configured checks, conventions, and file fingerprints |

## Check and refresh the setup

Run `shadowclone check --changed` to check uncommitted work, or `shadowclone check` for the repository. A local Claude Stop hook runs these checks before the agent finishes. Other agents receive the checks through repository instructions.

Run `shadowclone sync` to refresh the setup while preserving conflicting edits. Text outside managed sections stays yours, and edited managed sections are preserved for review.

## Setup options

Use `--personal` or `--no-personal` to include or exclude applicable personal guidance. Repeat `--skill <name>` to copy selected personal skills with their resources. Use `--no-enforce` to skip the Claude Stop hook.

Private builds cannot weaken shared repository requirements. A skill omitted from Shadowclone's routing may still be discovered through the host agent's global configuration.
