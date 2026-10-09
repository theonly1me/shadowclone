# Command reference

Run `shadowclone --help` for the full command shape. Run `shadowclone` with no arguments to see the current result and the next step.

## Set up

| Command                                       | Purpose                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `shadowclone init`                            | Choose consent for learning and skill maintenance                  |
| `shadowclone init --advanced`                 | Choose each capture source on its own                              |
| `shadowclone init --status --json`            | Check whether setup exists, without a change                       |
| `shadowclone init --repo`                     | Set up shared instructions, skills, and checks for this repository |
| `shadowclone wizard`                          | Pick skills in the browser                                         |
| `shadowclone wizard --repo`                   | Open the wizard for this repository                                |
| `shadowclone wizard --no-open`                | Print the local URL and do not open a browser                      |
| `shadowclone wizard --cli`                    | Configure a build in the terminal                                  |
| `shadowclone install --agent all --global`    | Install native guidance for every agent                            |
| `shadowclone install --agent <agent> --local` | Install guidance for this repository only                          |
| `shadowclone uninstall --global` or `--local` | Remove the integrations that Shadowclone owns in that scope        |
| `shadowclone sync`                            | Refresh maintained skills, bundled skills, and native routing      |
| `shadowclone doctor`                          | Check the installation and the effective policy                    |
| `shadowclone forget --all`                    | Remove all Shadowclone state and the files that it owns            |

Agent identifiers are `claude-code`, `codex`, `cursor`, `antigravity`, and `pi`. Add `--subagent` to install an optional local Claude subagent. Add `--auto-delegate` to allow automatic delegation.

## Learn

| Command                                                                                | Purpose                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `shadowclone learn`                                                                    | Index sessions and report, with no model call                       |
| `shadowclone learn --deep`                                                             | Run a bounded learning pass with a model                            |
| `shadowclone remember [--repo or --global] <text>`                                     | Record a rule yourself                                              |
| `shadowclone import`                                                                   | Read consented repository guidance as evidence                      |
| `shadowclone recall <query> [--limit 1..10]`                                           | Search the scoped reference records                                 |
| `shadowclone learning enable`, `disable`, or `status`                                  | Turn background learning on or off, or read the last attempt        |
| `shadowclone learning list` or `pending`                                               | List active guidance, or every open review and publication decision |
| `shadowclone learning show <key>`                                                      | Read the redacted evidence, the guidance, and the scope             |
| `shadowclone learning apply <key>` or `reject <key>`                                   | Decide a learned rule                                               |
| `shadowclone learning retire <key>` or `narrow <key>`                                  | Preview a retirement, or a limit to this repository                 |
| `shadowclone learning replace <key> <guidance>`                                        | Preview a replacement                                               |
| `shadowclone learning remove-source <source>`                                          | Preview the removal of guidance that one source alone supports      |
| `shadowclone learning repositories` and `bind <id>`                                    | Review and confirm repository links for past sessions               |
| `shadowclone learning acknowledge <key>`                                               | Mark later corrections as reviewed                                  |
| `shadowclone learning probe <key> --agent <agent> --task <text> --expect <text> --yes` | Test one exact response on macOS                                    |
| `shadowclone learning probe status`                                                    | Read the last probe receipt                                         |

`learn` accepts `--dry-run`, `--apply`, `--engine <id>`, `--model <id>`, `--reasoning-effort <level>`, and `--max-calls <n>`. See [learning](learning.md).

## Skills, context, and history

| Command                                                        | Purpose                                             |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `shadowclone skills`                                           | List the bundled skills                             |
| `shadowclone skills list`                                      | List the skills in your configured roots            |
| `shadowclone skills update`                                    | Review the library and update skills                |
| `shadowclone skills pending`                                   | List unpublished learning and conflicts             |
| `shadowclone skills show <id>`, `apply <id>`, or `reject <id>` | Decide a proposal                                   |
| `shadowclone skills configure [--repo or --global]`            | Choose the skill roots to maintain                  |
| `shadowclone skills automatic on` or `off`                     | Allow or stop automatic edits                       |
| `shadowclone skills retry <key>` or `exclude <key> <reason>`   | Queue a record again, or keep it unpublished        |
| `shadowclone skills disable`                                   | Stop access to the skill library                    |
| `shadowclone context --explain`                                | Show the guidance that is active in this repository |
| `shadowclone history [revision]`                               | List revisions, or show one                         |
| `shadowclone undo <revision>`                                  | Restore the files of a revision                     |

`skills configure` also accepts `--root <directory>` and `--third-party`. See [skill maintenance](skills.md).

## Review, cloud, and repository

| Command                                                           | Purpose                                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `shadowclone review <pr>`                                         | Review a pull request on this machine and write a Markdown file |
| `shadowclone review --base <ref>`                                 | Review the commits on this branch since it left `<ref>`         |
| `shadowclone review <pr> --cloud`                                 | Ask the cloud bot to review a pull request                      |
| `shadowclone bot setup --bot <login>`                             | Set up a cloud bot with a machine account                       |
| `shadowclone bot setup`                                           | Open the browser setup, which also offers a GitHub App          |
| `shadowclone bot status [--repo owner/repository]`                | Show the setup steps that are still open                        |
| `shadowclone bot export --skill <name> --output <private-folder>` | Save skills to a folder outside the checkout, with no upload    |
| `shadowclone check [--changed]`                                   | Run the repository checks                                       |

`review` accepts `--no-checks`, `--offline`, `--repo owner/repository`, `--output file.md`, `--model <id>`, and `--effort <level>`. The cloud workflow also uses `review prepare`, `checks`, `analyze`, and `publish`. See [reviews](reviews.md).

`bot setup` accepts `--bot <login>`, `--engine claude` or `codex`, `--codex-auth api-key` or `plan`, `--app`, `--repo owner/repository`, `--yes`, and `--no-open`. A machine account is the default identity. `--app` selects a GitHub App. `--bot` and `--app` exclude each other. See the [cloud bot guide](cloud-bot.md).

`check` accepts `--format human`, `json`, or `claude-stop`.

## Migrate and serve

| Command                             | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `shadowclone migrate skills`        | Preview a move from a profile installation to skills       |
| `shadowclone migrate claude-memory` | Preview the older one-time import of Claude memory         |
| `shadowclone profile repair`        | Preview repairs for a profile installation                 |
| `shadowclone mcp`                   | Serve the [MCP tools](mcp.md) on standard input and output |

## Install notes

A repository install adds each file that it creates to `.git/info/exclude`, so the files stay out of commits. Uninstall removes those entries.

If an agent's instruction file links to a regular file in your home folder, Shadowclone keeps the link and writes its block into that file. An example is `~/.codex/AGENTS.md` that points to `~/.agents/AGENTS.md`.

If `~/.claude/CLAUDE.md` imports the same file with `@`, Claude Code gets no second block. Shadowclone follows no other link. Setup skips that agent, installs the others, and names the link and its target. `shadowclone install --agent <agent>` fails on such a link until you replace it with a regular file.

A Codex repository install writes `AGENTS.override.md`. Codex reads one instruction file in each folder, so the override would hide an existing `AGENTS.md`.

In that case the install skips Codex, names both files, and exits with status 1. Other agents still install. Run `shadowclone install --agent codex --global` instead. If an earlier version created the override, the install says so and explains how to remove it.

## Non-interactive setup

An agent can pass all three consent decisions without prompts:

```bash
shadowclone init --learn --skill-maintenance --background-learning
```

Each flag has a `--no-` form. If you pass one consent flag, you must pass all three. Background learning needs session learning. An incomplete command exits and writes no configuration.

## Contributor commands

The [evaluation guide](evaluations.md) explains the contributor benchmark.
