![Shadowclone: your engineering instincts, as portable skills for every coding agent](docs/assets/shadowclone-banner.png)

# Shadowclone

[![HOL Guard](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dtheonly1me%252Fshadowclone%26metric%3Dtrust)](https://hol.org/registry/plugins/theonly1me%2Fshadowclone)
[![Shadowclone trust badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fhol.org%2Fapi%2Fregistry%2Fbadges%2Fplugin%3Fslug%3Dshadowclone%252Fshadowclone%26metric%3Dtrust%26style%3Dflat)](https://hol.org/registry/plugins/shadowclone%2Fshadowclone)

Shadowclone maintains the skills, instructions, and checks that help **Claude Code, Codex, Pi, Cursor, and Antigravity** follow your engineering preferences. It works with the coding agents you already use and keeps you in control of what it reads and changes.

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

| Step | Command                                                         | What happens                                                        |                    Time |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------: |
| 1    | `shadowclone init`                                              | Answer three questions about learning and skill maintenance         |          About 1 minute |
| 2    | `shadowclone learn --deep`                                      | Learn from enabled past sessions; repeat if more history remains    | Up to 5 minutes per run |
| 3    | `shadowclone learning pending` and `shadowclone skills pending` | Review learned rules, scope, and publication before relying on them |          About 1 minute |

Setup takes about two to three minutes, excluding learning. Deep learning needs an installed and configured `claude`, `codex`, `cursor-agent`, or `pi` CLI. [Pi setup](docs/guides/pi.md) uses any suitable model configured in Pi, including local providers. Claude Code learning on Linux needs `bwrap` and `socat` for its sandbox.

**Skip learning.** Run `shadowclone wizard` by itself if you do not want Shadowclone to read sessions or call a model. It starts from an empty active environment and lets you choose a build locally.

Run `shadowclone` to see the current result and next action. Use `shadowclone wizard` to browse optional workflow skills in a browser.

**Delegate a pull request.** The optional `shadowclone-work` skill takes a request, an issue, or an existing PR to ready for review: green checks, conflicts resolved, and review comments fixed or left for you. It replies to fixed comments with commit SHAs only and never merges. [Use delegated work](docs/guides/delegated-work.md).

**Use a personal GitHub clone.** Run `shadowclone bot setup` from a repository checkout. Name your App, select its repositories, and review the exact guidance before connecting your Claude subscription. The clone handles owner issues and tagged PR requests. Live installation qualification is pending. [Set up a GitHub clone](docs/guides/github-clones.md).

## Evaluations

We tested 24 fixed engineering tasks across eight preference families, with three repetitions per setup and model. Scores measure preference adherence, with each family weighted equally.

| Setup                                     | GPT 6.1 Sol | GPT 6 Luna | Claude Sonnet 5.5 | Claude Opus 5.5 |
| ----------------------------------------- | ----------: | ---------: | ----------------: | --------------: |
| Agent alone                               |       77.3% |      59.0% |             56.5% |           53.2% |
| Existing user skills                      |       85.2% |      80.6% |             76.4% |           73.6% |
| Existing skills + Shadowclone routing     |       86.1% |      72.7% |             76.9% |           75.9% |
| Existing skills + handwritten preferences |       92.4% |      81.2% |             91.7% |           86.1% |
| Existing skills + Shadowclone learning    |       89.4% |      83.3% |             90.0% |           82.9% |

Shadowclone learning improved recorded adherence over existing skills on all four models. The gain ranges from 2.8 to 13.7 percentage points. Handwritten preferences provide a reference for what agents can follow when the intended rules are supplied directly.

The learning setup includes routing and actual learned preferences from synthetic correction sessions. These results measure preference delivery on this task set. [Read the setup definitions, family scores, methods, and measurement limits](evals.md).

## Privacy comes first

**There is no Shadowclone collection service or telemetry.** Learning records, revisions, and original-library snapshots stay on your machine. Model work goes through the authenticated agent CLI you select and is subject to that provider's terms.

**You choose what it reads.** Every capture source is off by default and has its own consent setting. Reading sessions does not silently enable memory, repository metadata, or skill editing.

| Operation                      | What the selected provider can receive                                          |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Learning and skill maintenance | Selected redacted instructions, steering, and supporting context                |
| Personal GitHub clone          | The reviewed skills, native rules, selected repository, and issue or PR task    |
| Browser editor                 | Nothing merely from opening it; optional AI drafting sends reviewed form fields |
| Evaluation                     | Synthetic prompts, the tested setup's guidance, and generated code              |

**Redaction is a boundary, not an anonymity guarantee.** Tool results, tool-returned file contents, thinking blocks, and data-access results are excluded from learning. Use only sources and repositories you are authorized to send to the selected provider.

**Removal stays in your control.** Disable background learning with `shadowclone learning disable`, stop automatic skill edits with `shadowclone skills automatic off`, or remove recorded state with `shadowclone forget --all`. See the [privacy policy](PRIVACY.md), [data handling](docs/data-handling.md), and [enterprise controls](docs/architecture/07-enterprise.md) for sources, storage, managed policy, and removal details.

## Guides

| Guide                                           | Use it to                                                      |
| ----------------------------------------------- | -------------------------------------------------------------- |
| [Agent builds](docs/guides/agent-builds.md)     | Choose, create, and equip skills                               |
| [Learning](docs/guides/learning.md)             | Run deep learning, background learning, or record a preference |
| [Skill maintenance](docs/guides/skills.md)      | Review updates, conflicts, history, and undo                   |
| [Repository setup](docs/guides/repositories.md) | Share checks and skills with a repository                      |
| [How it works](docs/guides/how-it-works.md)     | Follow guidance from consented evidence to coding agents       |
| [Command reference](docs/guides/commands.md)    | Find everyday and advanced commands                            |

**Further reading:** [Documentation index](docs/README.md) · [Architecture](docs/architecture/README.md) · [Design history](docs/design/README.md) · [Migration](docs/migration.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

Shadowclone is MIT licensed.
