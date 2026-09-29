# Learning

Shadowclone can learn reusable instructions and corrections from the sources you enable. Model-assisted learning needs an installed and authenticated `claude`, `codex`, or `cursor-agent` CLI. Antigravity supports capture and native guidance, while learning uses one of the other CLIs.

## Run deep learning

```bash
shadowclone learn --deep
```

Shadowclone compares eligible evidence with existing guidance and proposes changes for review. Accepted learning can update skills within your edit permissions.

Each invocation allows up to 20 model calls and five minutes. Run it again if the result says more history remains. The first pass during interactive setup is smaller, with up to 12 calls and 90 seconds.

| Option | Behavior |
| --- | --- |
| `--dry-run` | Preview without applying; this still calls the model |
| `--apply` | Accept supported proposals without the confirmation prompt |
| `--engine <id>` | Select an eligible learning engine |
| `--model <id>` | Select a model supported by that engine |
| `--reasoning-effort <level>` | Set the supported reasoning effort |
| `--max-calls <n>` | Lower or raise the attempted-call ceiling for this invocation |

Plain `shadowclone learn` indexes and reports locally after setup. A first interactive run can initialize Shadowclone and offer an authorized first learning pass.

Use `shadowclone init --advanced` to choose capture sources individually.

## Background learning

Background learning has its own consent. When enabled, sessions containing reusable guidance can improve future sessions. A temporary exception or an interruption alone does not become a standing preference.

```bash
shadowclone learning status
shadowclone learning enable
shadowclone learning disable
```

## Record a preference

Record repository guidance directly:

```bash
shadowclone remember --repo "Use complete variable names."
```

Use `--global` only for guidance intended for every repository. Recording a preference and publishing it into skills are separate steps. `shadowclone skills pending` shows publication work, and `shadowclone context --explain` shows what is active.

See [data handling](../data-handling.md) for capture, redaction, provider access, and storage boundaries.
