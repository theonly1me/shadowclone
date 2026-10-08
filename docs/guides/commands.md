# Command reference

Run `shadowclone --help` for the complete command shape.

For contributor evaluations, use the source runner with `bun run eval --protocol preference-respect-v3 --help`. The [evaluation guide](evaluations.md) explains five setups, private held-out tasks, preparation reuse, approved run scopes, and the separate routing comparison.

## Everyday commands

| Command                                                                                | Purpose                                                                                         |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `shadowclone init`                                                                     | Configure consent, learning, and skill maintenance                                              |
| `shadowclone init --status --json`                                                     | Check whether setup exists without changing it                                                  |
| `shadowclone wizard`                                                                   | Choose and equip skills in the browser                                                          |
| `shadowclone learn --deep`                                                             | Run a bounded model-assisted learning pass                                                      |
| `shadowclone learning list` or `pending`                                               | List active guidance or all review and publication decisions                                    |
| `shadowclone learning show <key>`                                                      | Inspect redacted evidence, exact guidance, and scope                                            |
| `shadowclone learning apply <key>` or `reject <key>`                                   | Decide a learned rule without repeating extraction; approval can call the model for publication |
| `shadowclone learning repositories` and `bind <id>`                                    | Review and confirm past session repository associations                                         |
| `shadowclone learning retire <key>` or `narrow <key>`                                  | Preview retirement or restriction to the current repository                                     |
| `shadowclone learning replace <key> <guidance>`                                        | Preview an explicit replacement                                                                 |
| `shadowclone learning remove-source <source>`                                          | Preview removal of guidance supported only by one source                                        |
| `shadowclone learning probe <key> --agent <agent> --task <text> --expect <text> --yes` | Test one exact response against redacted installed guidance on macOS                            |
| `shadowclone learning probe status`                                                    | Inspect the last private probe receipt                                                          |
| `shadowclone learning acknowledge <key>`                                               | Mark recorded later corrections reviewed without changing guidance                              |
| `shadowclone doctor`                                                                   | Check the installation and effective policy                                                     |
| `shadowclone context --explain`                                                        | Show the guidance active in the current repository                                              |
| `shadowclone skills pending`                                                           | Review unpublished learning and conflicts                                                       |
| `shadowclone bot setup`                                                                | Start personal GitHub App registration and reviewed cloud setup                                 |
| `shadowclone bot export --skill shadowclone-work --output <private-file>`              | Save selected guidance outside the checkout without uploading                                   |
| `shadowclone bot status`                                                               | Show saved clone installation metadata and its setup PR                                         |
| `shadowclone sync`                                                                     | Refresh maintained skills and native routing                                                    |
| `shadowclone review <pr>`                                                              | Review a pull request on this machine and write a markdown file                                 |
| `shadowclone review <pr> --cloud`                                                      | Ask the GitHub clone to review a pull request and post its review                               |

## Other commands

| Command                                       | Purpose                                                   |
| --------------------------------------------- | --------------------------------------------------------- |
| `shadowclone import`                          | Refresh consented repository guidance as evidence         |
| `shadowclone recall <query>`                  | Search available scoped references                        |
| `shadowclone install --agent all --global`    | Install native guidance manually                          |
| `shadowclone install --agent <agent> --local` | Install guidance for this repository without shared setup |
| `shadowclone uninstall --global` / `--local`  | Remove owned integrations in the selected scope           |
| `shadowclone migrate skills`                  | Preview migration from an older profile installation      |
| `shadowclone mcp`                             | Serve context and maintenance tools to a connected agent  |

Supported agent identifiers are `claude-code`, `codex`, `cursor`, `antigravity`, and `pi`. Optional local Claude subagents use `--subagent`; automatic delegation is a separate `--auto-delegate` choice. See [Pi setup](pi.md) for provider configuration and execution limits.

A repository install adds each file that it creates to `.git/info/exclude`, so the files stay out of commits. Uninstall removes those entries.

If an agent's instruction file is a link to a regular file in your home folder, for example `~/.codex/AGENTS.md` pointing to `~/.agents/AGENTS.md`, Shadowclone keeps the link and writes its block into that file. If `~/.claude/CLAUDE.md` imports the same file with `@`, Claude Code gets no second block. Shadowclone does not follow any other link. Setup skips that agent, installs the others, and ends with a line that names the link and the file it points to. `shadowclone install --agent <agent>` fails on such a link until it is replaced by a regular file.

A Codex repository install writes `AGENTS.override.md`, and Codex reads only one instruction file in each folder. If the repository already has an `AGENTS.md`, the override would hide it, so the install skips Codex, names both files, and exits with status 1. Other agents still install. Use `shadowclone install --agent codex --global` for Codex in such a repository. If an earlier version created the override, the install says so and tells you how to remove it.

## Pull request reviews

`shadowclone review <pr>` accepts `--no-checks`, `--repo owner/repository`, `--output file.md`, `--model <id>`, and `--effort <level>`. `--offline` turns off web search, page fetches, and the dependency check. The cloud workflow uses `review prepare`, `review checks`, `review analyze`, and `review publish`. See [pull request reviews](reviews.md).

## Delegated engineering work

Equip the optional `shadowclone-work` skill in `shadowclone wizard`. It has no commands of its own; see [delegated work](delegated-work.md).

## Non-interactive setup

Agent-led setup can pass all consent decisions without prompts:

```bash
shadowclone init --learn --skill-maintenance --background-learning
```

Each flag has a `--no-` form. If any consent flag is present, all three decisions are required. Background learning requires session learning. An incomplete non-interactive command exits without writing configuration.
