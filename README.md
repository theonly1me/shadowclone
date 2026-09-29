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

Then tell the agent: **Set up Shadowclone.** The packaged setup skill installs the CLI if needed, asks you for three separate consent choices, installs native guidance for detected agents, and prints the local build URL. It never uses elevated privileges or chooses data access for you.

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
| 3 | `shadowclone wizard` | Choose skills in the browser and review the files before applying them | About 1 minute |

Setup takes about two to three minutes, excluding learning. Deep learning needs an installed and authenticated `claude`, `codex`, or `cursor-agent` CLI.

**Skip learning.** Run `shadowclone wizard` by itself if you do not want Shadowclone to read sessions or call a model. It starts from an empty active environment and lets you choose a build locally.

The browser shows a bounded constellation grouped from each skill's category and purpose. Drag to pan, scroll or pinch to zoom, search to center a skill, select a hub to focus it, or switch to the list view. Large libraries form nested hubs instead of making the page longer.

## Evaluations

The preference study tested ordinary coding tasks on GPT-6 Sol, GPT-6 Luna, Sonnet 5.5, and Opus 5.5. Each agent ran with no personal help, with existing skills, with Shadowclone skills, and with Shadowclone skills plus deep learning.

| Share of preferences followed | GPT-6 Sol | GPT-6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Agent alone | 72% | 73% | 55% | 57% |
| With Shadowclone skills | 84% | 83% | 68% | 68% |
| With Shadowclone skills and deep learning | 97% | 88% | 76% | 82% |
| Improvement with skills and deep learning | **+25** | **+15** | **+22** | **+25** |

Here is what changed in practice. Each cell compares the agent alone with Shadowclone skills and deep learning.

| Preference | GPT-6 Sol | GPT-6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Review reply preferences | 2 of 6 → 6 of 6 | 2 of 6 → 6 of 6 | 0 of 6 → 6 of 6 | 0 of 6 → 6 of 6 |
| Failing test first | 0 of 3 → 3 of 3 | 0 of 3 → 2 of 3 | 0 of 3 → 0 of 3 | 0 of 3 → 2 of 3 |
| Pull request checklist | 0 of 3 → 3 of 3 | 3 of 3 → 3 of 3 | 0 of 3 → 1 of 3 | 2 of 3 → 3 of 3 |

Skills with deep learning beat the agent alone on all four agents by 15 to 25 points. The gain is statistically clear on GPT-6 Sol and Opus 5.5, and directional on the other two. The participant's existing skills scored in the same range and slightly higher on GPT-6 Luna. [Read the tasks, intervals, and limitations](evals.md).

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
