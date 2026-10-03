![Shadowclone: your engineering instincts, as portable skills for every coding agent](docs/assets/shadowclone-banner.png)

# Shadowclone

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

Seven fixed tasks compare four setups using synthetic skills and correction sessions. Scores measure the share of applicable preferences followed in completed sessions, with equal weight per task. Each setup ran three repetitions; one timed-out Luna session is excluded from this view.

| Preferences followed               | GPT 6.1 Sol, medium | GPT 6 Luna, high | Sonnet 5.5, high | Opus 5.5, medium |
| ---------------------------------- | ------------------: | ---------------: | ---------------: | ---------------: |
| Bare                               |               96.2% |            97.1% |            59.4% |            52.1% |
| Existing user skills               |                100% |             100% |            65.0% |            63.8% |
| Skills plus Shadowclone routing    |                100% |             100% |            65.0% |            63.8% |
| Skills, routing, and deep learning |                100% |             100% |            81.7% |            96.4% |

Learning added 16.7 percentage points over existing skills on Sonnet and 32.6 on Opus; both 95% bootstrap intervals were above zero. Both Codex models were already at 100% with skills, and routing alone tied skills. All completed tasks passed correctness and safety checks. Luna's existing-skills score covers twenty completed sessions; the other setups cover twenty-one. Its original full-matrix report remains incomplete.

The existing skill contains three preferences; one shared learning run added two from synthetic corrections. These public development tasks show a specific learning benefit, with no claim about other users, repositories, or engineering throughput. [Read the methods, intervals, timeout exclusion, and historical study](evals.md). The [eval guide](docs/guides/fixed-evals.md#how-this-follows-the-claudedev-recommendations) explains which Claude.dev recommendations the benchmark follows and the work still needed for held-out hillclimbing.

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
