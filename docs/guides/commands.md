# Command reference

Run `shadowclone --help` for the complete command shape.

## Everyday commands

| Command | Purpose |
| --- | --- |
| `shadowclone init` | Configure consent, learning, and skill maintenance |
| `shadowclone init --status --json` | Check whether setup exists without changing it |
| `shadowclone wizard` | Choose and equip skills in the browser |
| `shadowclone learn --deep` | Run a bounded model-assisted learning pass |
| `shadowclone learning list` or `pending` | List active guidance or all review and publication decisions |
| `shadowclone learning show <key>` | Inspect redacted evidence, exact guidance, and scope |
| `shadowclone learning apply <key>` or `reject <key>` | Decide a learned rule without repeating extraction; approval can call the model for publication |
| `shadowclone learning repositories` and `bind <id>` | Review and confirm past session repository associations |
| `shadowclone learning retire <key>` or `narrow <key>` | Preview retirement or restriction to the current repository |
| `shadowclone learning replace <key> <guidance>` | Preview an explicit replacement |
| `shadowclone learning remove-source <source>` | Preview removal of guidance supported only by one source |
| `shadowclone learning probe <key> --agent <agent> --task <text> --expect <text> --yes` | Test one exact response against redacted installed guidance on macOS |
| `shadowclone learning probe status` | Inspect the last private probe receipt |
| `shadowclone learning acknowledge <key>` | Mark recorded later corrections reviewed without changing guidance |
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

Agent-led setup can pass all consent decisions without prompts:

```bash
shadowclone init --learn --skill-maintenance --background-learning
```

Each flag has a `--no-` form. If any consent flag is present, all three decisions are required. Background learning requires session learning. An incomplete non-interactive command exits without writing configuration.
