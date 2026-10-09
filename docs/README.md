# Documentation

Start with the [README](../README.md) to install Shadowclone and pick your first skills.

## Guides

| Guide                                       | Use it to                                                        |
| ------------------------------------------- | ---------------------------------------------------------------- |
| [Agent builds](guides/agent-builds.md)      | Pick skills on the skill map and choose a build scope            |
| [Learning](guides/learning.md)              | Run deep learning, turn on background learning, or record a rule |
| [Skill maintenance](guides/skills.md)       | Review updates and conflicts, and undo a change                  |
| [Repository setup](guides/repositories.md)  | Share checks and skills with a repository                        |
| [Pi setup](guides/pi.md)                    | Use Pi models, including local models                            |
| [Delegated work](guides/delegated-work.md)  | Take a change or a pull request to ready for review              |
| [Cloud bot](guides/cloud-bot.md)            | Set up a GitHub bot for issues, mentions, and reviews            |
| [Reviews](guides/reviews.md)                | Review a pull request on your machine or in the cloud            |
| [MCP server](guides/mcp.md)                 | Give a connected agent the Shadowclone tools                     |
| [Command reference](guides/commands.md)     | Find every command                                               |
| [Migration](guides/migration.md)            | Move a profile installation to skills                            |
| [Enterprise controls](guides/enterprise.md) | Set scope and managed policy                                     |

## Privacy and results

- [Privacy](../PRIVACY.md): what Shadowclone reads, sends, and removes.
- [Data handling](data-handling.md): sources, provider requests, local files, deletion, and the boundaries that a change must keep.
- [Security](../SECURITY.md): how to report a vulnerability.
- [Evaluation results](../evals.md): preference adherence for five setups and four models.

## Understand and contribute

- [Motivation](motivation.md): why the project exists, and how it relates to other approaches.
- [Architecture](architecture/README.md): the packages, their dependencies, the data flow, and the trust boundaries.
- [Design history](design/README.md): decisions, and the designs that replaced them.
- [Evaluations](../evals/README.md): the suites, what they measure, and how to authorize paid runs.
- [Contributing](../CONTRIBUTING.md): setup, checks, how to add a package, and pull requests.

Coding assistants start with [AGENTS.md](../AGENTS.md). Each package also has an `AGENTS.md` with its purpose and rules.

## Open work

- Test setup, migration, conflict recovery, and removal on real installations with explicit source consent.
- Measure whether maintained guidance reduces the effort of repeated tasks. Preference scores do not measure productivity.
- Add a model runner for Antigravity, which has capture and native guidance only. No API or local-endpoint engine exists.
- Merge outcomes, issue-tracker intake, and coordination between concurrent clones are outside the learning workflow. Each needs its own evidence and action boundaries first.
