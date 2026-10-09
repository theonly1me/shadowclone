# Shadowclone plugin

Shadowclone makes coding agents follow your engineering taste, in Claude Code, Codex, Cursor, Pi, and Antigravity. This plugin gives an agent one workflow to install and configure [Shadowclone](https://shadowclone.co). It does not turn on the bundled skill library until you choose a build.

## Use

Install the plugin, start a new agent session, and say:

```text
Set up Shadowclone.
```

The `setup-shadowclone` skill does these steps:

1. It checks the CLI version and offers to install or upgrade the CLI, with no elevated privileges. It needs CLI 0.0.13 or newer.
2. It asks you for three separate consent decisions.
3. It sets up the coding agents that it detects.
4. It opens the local build editor.

It keeps any consent settings that already exist.

The bundled MCP configuration starts `shadowclone mcp` after you install the CLI. The server uses standard input and output on your machine and needs no Shadowclone service credentials. See the [MCP guide](https://github.com/theonly1me/shadowclone/blob/main/docs/guides/mcp.md) for its seven tools.

Read the [privacy policy](https://github.com/theonly1me/shadowclone/blob/main/PRIVACY.md) and the [security policy](https://github.com/theonly1me/shadowclone/blob/main/SECURITY.md).
