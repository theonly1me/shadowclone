# Shadowclone plugin

This plugin gives an agent one workflow to install and set up [Shadowclone](https://shadowclone.co). It turns on no bundled skill until you choose a build.

## Use

Install the plugin, start a new session, and say:

```text
Set up Shadowclone.
```

The `setup-shadowclone` skill does these steps:

1. It checks the CLI version and offers to install or upgrade it, with no elevated privileges. It needs CLI 0.0.13 or newer.
2. It asks for three separate consent decisions and keeps existing consent settings.
3. It sets up the agents that it detects and opens the local build editor.

The bundled MCP configuration starts `shadowclone mcp` on your machine after you install the CLI. It needs no Shadowclone credentials. See the [MCP guide](https://github.com/theonly1me/shadowclone/blob/main/docs/guides/mcp.md).

Read the [privacy](https://github.com/theonly1me/shadowclone/blob/main/PRIVACY.md) and [security](https://github.com/theonly1me/shadowclone/blob/main/SECURITY.md) policies.
