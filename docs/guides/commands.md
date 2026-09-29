# Command reference

Run `shadowclone --help` for the complete command shape.

## Everyday commands

| Command | Purpose |
| --- | --- |
| `shadowclone init` | Configure consent, learning, and skill maintenance |
| `shadowclone wizard` | Choose and equip skills in the browser |
| `shadowclone learn --deep` | Run a bounded model-assisted learning pass |
| `shadowclone doctor` | Check the installation and effective policy |
| `shadowclone context --explain` | Show the guidance active in the current repository |
| `shadowclone skills pending` | Review unpublished learning and conflicts |
| `shadowclone sync` | Refresh maintained skills and native routing |

## Other commands

| Command | Purpose |
| --- | --- |
| `shadowclone import` | Refresh consented repository guidance as evidence |
| `shadowclone recall <query>` | Search available scoped references |
| `shadowclone install --agent all --global` | Install native guidance manually |
| `shadowclone install --agent <agent> --local` | Install guidance for this repository without shared setup |
| `shadowclone uninstall --global` / `--local` | Remove owned integrations in the selected scope |
| `shadowclone migrate skills` | Preview migration from an older profile installation |
| `shadowclone mcp` | Serve context and maintenance tools to a connected agent |

Supported agent identifiers are `claude-code`, `codex`, `cursor`, and `antigravity`. Optional local Claude subagents use `--subagent`; automatic delegation is a separate `--auto-delegate` choice.
