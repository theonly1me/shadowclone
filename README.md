![Shadowclone: your engineering instincts, as portable skills for every coding agent](docs/assets/shadowclone-banner.png)

# Shadowclone

Shadowclone maintains the skills, instructions, and checks that help **Claude Code, Codex, Cursor, and Antigravity** follow your engineering preferences. It works with the coding agents you already use and keeps you in control of what it reads and changes.

## Get started

### Let your agent set it up

In Claude Code, add and install the plugin:

```text
/plugin marketplace add theonly1me/shadowclone
/plugin install shadowclone@shadowclone
```

In Codex, add the marketplace and install **Shadowclone** from the Plugins Directory:

```bash
codex plugin marketplace add theonly1me/shadowclone
codex plugin add shadowclone@shadowclone
```

Then tell the agent: **Set up Shadowclone.** The packaged setup skill checks the CLI version, offers installation or an upgrade when needed, asks you for three separate consent choices, installs native guidance for detected agents, and prints the local build URL. This setup flow requires CLI 0.0.13 or newer. It never uses elevated privileges or chooses data access for you.

Cursor, Antigravity, and other skill-compatible agents can use the portable [`setup-shadowclone` skill](plugins/shadowclone/skills/setup-shadowclone/SKILL.md). Once any supported agent completes setup, Shadowclone synchronizes native guidance across the detected agents on your machine.

### Set it up manually

Install the CLI:

```bash
npm install -g @shadowclone/cli
```

| Step | Command | What happens | Time |
| --- | --- | --- | ---: |
| 1 | `shadowclone init` | Answer three questions about learning and skill maintenance | About 1 minute |
| 2 | `shadowclone learn --deep` | Learn from enabled past sessions; repeat if more history remains | Up to 5 minutes per run |
| 3 | `shadowclone learning pending` and `shadowclone skills pending` | Review learned rules, scope, and publication before relying on them | About 1 minute |

Setup takes about two to three minutes, excluding learning. Deep learning needs an installed and authenticated `claude`, `codex`, or `cursor-agent` CLI. Claude Code learning on Linux needs `bwrap` and `socat` for its sandbox.

**Skip learning.** Run `shadowclone wizard` by itself if you do not want Shadowclone to read sessions or call a model. It starts from an empty active environment and lets you choose a build locally.

Run `shadowclone` to see the current result and next action. Use `shadowclone wizard` to browse optional workflow skills in a browser.

**Delegate a task.** The optional `shadowclone-work` skill records your standards, acceptance criteria, checks, and review in a private task receipt. It adds work tracking to an existing Claude Code or Codex session. Start with review handoff; shipping actions require explicit repository grants. Native workflow qualification is still pending. [Use delegated work](docs/guides/delegated-work.md).

## Evaluations

The preference study compared agent alone, existing user skills, those skills plus Shadowclone setup, and setup plus deep learning on GPT-6 Sol, GPT-6 Luna, Sonnet 5.5, and Opus 5.5. After corrected scoring, deep learning over existing skills was +10.0, -2.5, +9.7, and +7.3 percentage points respectively, with every 95% interval including zero. It recovered a concrete review-reply preference across all four models. The study covers one participant and one synthetic repository. [Read all four setups, corrected results, and limitations](evals.md).

| Preferences followed | Sol | Luna | Sonnet | Opus |
| --- | ---: | ---: | ---: | ---: |
| Agent alone | 72% | 73% | 59% | 59% |
| Existing user skills | 87% | 91% | 70% | 79% |
| Existing skills plus Shadowclone setup | 84% | 83% | 72% | 72% |
| Setup plus deep learning | 97% | 88% | 80% | 86% |

## Privacy comes first

**There is no Shadowclone collection service or telemetry.** Learning records, revisions, and original-library snapshots stay on your machine. Model work goes through the authenticated agent CLI you select and is subject to that provider's terms.

**You choose what it reads.** Every capture source is off by default and has its own consent setting. Reading sessions does not silently enable memory, repository metadata, or skill editing.

| Operation | What the selected provider can receive |
| --- | --- |
| Learning and skill maintenance | Selected redacted instructions, steering, and supporting context |
| Browser editor | Nothing merely from opening it; optional AI drafting sends reviewed form fields |
| Delegated `run` | The authorized task worktree and guidance |
| Evaluation | Synthetic prompts, the tested setup's guidance, and generated code |

**Redaction is a boundary, not an anonymity guarantee.** Tool results, tool-returned file contents, thinking blocks, and data-access results are excluded from learning. Use only sources and repositories you are authorized to send to the selected provider.

**Removal stays in your control.** Disable background learning with `shadowclone learning disable`, stop automatic skill edits with `shadowclone skills automatic off`, or remove recorded state with `shadowclone forget --all`. See the [privacy policy](PRIVACY.md), [data handling](docs/data-handling.md), and [enterprise controls](docs/architecture/07-enterprise.md) for sources, storage, managed policy, and removal details.

## Guides

| Guide | Use it to |
| --- | --- |
| [Agent builds](docs/guides/agent-builds.md) | Choose, create, and equip skills |
| [Learning](docs/guides/learning.md) | Run deep learning, background learning, or record a preference |
| [Skill maintenance](docs/guides/skills.md) | Review updates, conflicts, history, and undo |
| [Repository setup](docs/guides/repositories.md) | Share checks and skills with a repository |
| [How it works](docs/guides/how-it-works.md) | Follow guidance from consented evidence to coding agents |
| [Command reference](docs/guides/commands.md) | Find everyday and advanced commands |

**Further reading:** [Documentation index](docs/README.md) · [Architecture](docs/architecture/README.md) · [Design history](docs/design/README.md) · [Migration](docs/migration.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

Shadowclone is MIT licensed.
