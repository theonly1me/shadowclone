# Shadowclone plugin

This plugin gives coding agents one workflow for installing and setting up [Shadowclone](https://shadowclone.co). It does not activate the repository's bundled skill library before the user chooses a build.

## Use

Install the plugin, start a new agent session, and say:

```text
Set up Shadowclone.
```

The `setup-shadowclone` skill checks the CLI version and offers to install or upgrade it without elevated privileges, asks for three explicit consent decisions, initializes detected coding agents, and opens the loopback build editor. It requires CLI 0.0.13 or newer. Existing consent settings are preserved.

The bundled MCP configuration starts `shadowclone mcp` after the CLI is installed. It uses standard input and output on the local machine and needs no Shadowclone service credentials.

See the repository [privacy policy](https://github.com/theonly1me/shadowclone/blob/main/PRIVACY.md) and [security policy](https://github.com/theonly1me/shadowclone/blob/main/SECURITY.md).
