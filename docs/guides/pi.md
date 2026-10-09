# Pi setup

Configure a model in Pi, then keep coding in Pi. Shadowclone supplies skills, native guidance, and consented learning. Pi owns the coding loop, the tools, the endpoints, the credentials, and the provider extensions. Because Pi runs any model that you configure, including local models, Shadowclone works with those models too.

The integration uses the APIs in `@earendil-works/pi-coding-agent` 1.0.0. It needs the `agent_settled` event and the `modelRegistry.streamSimple` extension API of Pi. The [provider design record](../design/003-provider-expansion.md#qualification-results) lists the checks on the installed harness and the limits that remain.

## Install

```bash
shadowclone init
shadowclone install --agent pi --global
```

Setup names the detected session locations before it asks for learning consent. If Shadowclone detects Pi, interactive setup also offers the models that Pi provides. Use `shadowclone init --advanced` for the separate Pi transcript choice. Installing the integration alone turns on no capture source.

- A global install manages a section in `~/.pi/agent/AGENTS.md`, an extension under `~/.pi/agent/extensions/`, and the shared skill `~/.agents/skills/shadowclone-context`.
- For one repository, run `shadowclone install --agent pi --local` in that repository. It uses `.pi/extensions/` and `.agents/skills/`.
- A repository install does not write the repository `AGENTS.md`, because your team may share that file. The extension loads guidance at session start. If an older version wrote a section there, the next install removes it, unless you edited it.
- Pi paths follow `PI_CODING_AGENT_DIR` when you set it.
- Manual content and supporting files stay protected. Codex and Pi share the global context skill. If you remove one installation, the other keeps its copy.

Restart Pi after the install. Start a new session, or use `/reload` in Pi, after guidance changes. Pi finds the shared skill locations through its [native skill support](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).

## Learning models

Automatic learning uses the model of the Pi session that started it. This includes providers that extensions register in that session.

A private socket connects the bounded learning worker to the extension model registry of Pi. The requests have an empty tool set. They exclude the messages, the system prompt, and the tool loop of the coding session. The extension keeps the bridge alive through pending learning during shutdown.

Standalone maintenance starts the installed Pi CLI in command mode from an empty temporary directory. It keeps the global provider configuration and the trusted global extensions of Pi.

For the request, it turns off the loading of instructions, skills, prompt templates, and tools. Project-only provider extensions work through their live session bridge. Standalone maintenance must use a model that you configured globally in Pi. If the selected model is not available, the request fails and Shadowclone does not choose another model.

Choose a saved model in the **Learning model** control of the browser wizard. You can also set it in the configuration:

```toml
[distillation]
deep = true
automatic = true
engine = "pi"
model = "ollama/your-configured-model"
```

Use the exact `provider/model` identifier that Pi offers. Selection follows these sources in order: command options, the session that started learning, saved preferences, and engine detection. A different agent does not carry over a saved model from the previous agent. Endpoints and credentials stay in the configuration of Pi.

```bash
shadowclone learn --deep --engine pi --model ollama/your-configured-model
shadowclone doctor
shadowclone learning status
shadowclone sync
```

Learning shares the call limits and time limits of Shadowclone. Pi enforces no dollar cap, and cost stays unknown when Pi does not report it. Learning rejects attempted tool calls and malformed structured responses, so the model must follow the learning schema. A local model alone does not meet a managed `local-only` policy, because Pi can configure remote providers.

## Capture and removal

The setting `sources.pi` is false by default. When you consent, Shadowclone reads complete records step by step from the version 3 JSONL sessions of Pi in its agent directory. Parent links keep each correction with its own branch. Learning excludes tool results, thinking, system messages, custom injected messages, compaction, and branch summaries. Your original sessions stay untouched.

```bash
shadowclone uninstall --agent pi --global
shadowclone uninstall --agent pi --local
```

Uninstall removes the integration files and sections that Shadowclone owns. An edited file blocks removal and stays for your review. Uninstall keeps your original sessions, other integrations, and skills that you maintain yourself.

Pi evaluation is not available, because the Pi coding tools do not meet the filesystem isolation contract of Shadowclone. You can keep coding in Pi with its existing permissions. Zed follows the agent that it hosts. This integration gives Zed no separate inference backend.
