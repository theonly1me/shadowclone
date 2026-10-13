# OpenCode setup

shadowclone gives OpenCode the same skills and native guidance as your other agents, and it can learn from the OpenCode sessions that you allow. It supports OpenCode 1.x (`opencode-ai`) and 2.x (`@opencode/cli`). OpenCode is not a learning model runner, so learning from its sessions uses another agent CLI that you configured, such as `claude` or `codex`.

The integration targets OpenCode 1.19.0 and 2.0.28. The [provider design record](../design/003-provider-expansion.md#opencode-integration) explains the choices.

## Install

```bash
shadowclone init
shadowclone install --agent opencode --global
```

`shadowclone init` installs the integration when it finds the `opencode` program or the OpenCode configuration folder. `shadowclone init --advanced` has a separate OpenCode transcript choice. Installing alone turns on no capture source.

- A global install manages a section in `~/.config/opencode/AGENTS.md`, the plugin `~/.config/opencode/plugins/shadowclone.js`, and the shared skill `~/.agents/skills/shadowclone-context`.
- `shadowclone install --agent opencode --local` writes `.opencode/plugins/shadowclone.js` and `.agents/skills/shadowclone-context` in one repository. It does not write the repository `AGENTS.md`, which your team may share.
- The configuration folder follows `OPENCODE_CONFIG_DIR`, then `XDG_CONFIG_HOME`.
- OpenCode reads both `~/.agents/skills` and `~/.claude/skills`, so it finds each personal skill twice. The two copies have the same content.

Restart OpenCode after the install.

**OpenCode 1.x and `~/.claude/CLAUDE.md`.** OpenCode 1.x reads `~/.claude/CLAUDE.md` only when `~/.config/opencode/AGENTS.md` does not exist. If the global install creates that file, OpenCode 1.x stops reading `~/.claude/CLAUDE.md`. To keep those instructions in OpenCode 1.x, add `"instructions": ["~/.claude/CLAUDE.md"]` to `~/.config/opencode/opencode.json`. OpenCode 2.x reads no `CLAUDE.md` file.

## Session context

One plugin file works on both OpenCode lines. Before the first model call of a session, the plugin runs `shadowclone hook native-start` and adds the context that it returns to the system prompt. OpenCode 1.x calls the plugin through the experimental `experimental.chat.system.transform` hook, and OpenCode 2.x calls it through the `context` hook. The `AGENTS.md` section still routes your skills if a later OpenCode 1.x release changes the experimental hook.

When a session becomes idle, the plugin runs `shadowclone hook native-end`. With background learning and OpenCode capture on, this can schedule a bounded learning run for that session.

## Capture and removal

The setting `sources.opencode` is false by default. After consent, shadowclone reads `opencode.db` in `~/.local/share/opencode` and leaves it untouched. `XDG_DATA_HOME` and `OPENCODE_DB` change that location.

Learning reads only the text that you typed. It excludes file contents that OpenCode adds to a prompt, reasoning, tool output, subagent sessions, and the messages that a fork copied. OpenCode 2.x copies 1.x sessions into new tables, and shadowclone reads each session once. Sessions from OpenCode releases before 1.2.0 are JSON files, and shadowclone does not read them.

`shadowclone uninstall --agent opencode --global` or `--local` removes the files and sections that shadowclone owns. An edited plugin blocks removal. Uninstall keeps your sessions, your OpenCode configuration, and the rest of your `AGENTS.md`.

shadowclone does not change `opencode.json`. To give OpenCode the shadowclone tools, add the MCP server as the [MCP guide](mcp.md#start-the-server) shows. OpenCode evaluation is unavailable.
