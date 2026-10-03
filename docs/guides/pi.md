# Pi setup

Configure a model in Pi, then keep coding in Pi. Shadowclone supplies skills, native guidance, and consented learning. Pi owns the coding loop, tools, endpoints, credentials, and provider extensions.

This integration uses the APIs in `@earendil-works/pi-coding-agent` 1.0.0. It requires Pi's `agent_settled` event and `modelRegistry.streamSimple` extension API. Installed-harness checks and remaining model qualification limits are recorded in the [provider design record](../design/003-provider-expansion.md#qualification-results).

```bash
shadowclone init
shadowclone install --agent pi --global
```

Setup names detected session locations before asking for learning consent. When Pi is detected, interactive setup also offers models available through Pi. Use `shadowclone init --advanced` for the separate Pi transcript choice. Installing the integration alone enables no capture source.

For repository installation, run `shadowclone install --agent pi --local` in that repository. Global installation manages a section in `~/.pi/agent/AGENTS.md`, an owned extension under `~/.pi/agent/extensions/`, and the shared `~/.agents/skills/shadowclone-context` skill. Repository installation uses `AGENTS.md`, `.pi/extensions/`, and `.agents/skills/`. Pi paths follow `PI_CODING_AGENT_DIR` when configured. Manual content and supporting files remain protected. Codex and Pi share the managed global context skill; removing one installation preserves the other's copy.

Restart Pi after installation. Start a new session or use Pi's `/reload` after guidance changes. Pi discovers the shared skill locations through its [native skill support](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).

## Learning models

Automatic learning inherits the triggering Pi session's model, including providers registered by extensions in that session. A private socket connects the bounded learning worker to Pi's extension model registry. Prepared requests contain an empty tool set and exclude the coding session's messages, system prompt, and tool loop. The extension keeps the bridge alive through pending learning during shutdown.

Standalone maintenance starts the installed Pi CLI in command mode from an empty temporary directory. It retains Pi's global provider configuration and trusted global extensions while disabling instruction, skill, prompt-template, and tool loading for the request. Project-only provider extensions remain available through their live session bridge; standalone maintenance must use a model configured globally in Pi. An unavailable selected model fails without selecting another model.

Choose a saved model in the browser editor's **Learning model** control, or set references in the existing configuration:

```toml
[distillation]
deep = true
automatic = true
engine = "pi"
model = "ollama/your-configured-model"
```

Use the exact `provider/model` identifier offered by Pi. Selection follows explicit command options, the triggering session, saved preferences, then engine detection. Selecting a different harness does not carry a saved model from the previous harness. Endpoints and credentials belong in Pi's configuration.

```bash
shadowclone learn --deep --engine pi --model ollama/your-configured-model
shadowclone doctor
shadowclone learning status
shadowclone sync
```

Learning shares Shadowclone's call and time limits. Pi does not enforce a dollar cap; cost remains unknown when unavailable. Learning rejects attempted tool calls and malformed structured responses. A configured model must be capable of following the learning schema. Local inference alone does not establish managed `local-only` policy compliance because Pi can configure remote providers.

## Capture and removal

The `sources.pi` setting defaults to false. Consented capture reads complete records incrementally from Pi's version 3 JSONL sessions under its agent directory. Parent links keep corrections associated with their own branch. Tool results, thinking, system messages, custom injected messages, compaction, and branch summaries are excluded from learning. Original sessions remain untouched.

```bash
shadowclone uninstall --agent pi --global
shadowclone uninstall --agent pi --local
```

Uninstall removes owned integration files and sections. Edited files block removal and remain available for review. It preserves original sessions, other integrations, and manually maintained skills.

Pi evaluation is unavailable. Its coding tools have not qualified for Shadowclone's filesystem isolation contract. Users can continue coding directly in Pi with its existing permissions. Zed follows the harness it hosts and gains no separate inference backend from this integration.
