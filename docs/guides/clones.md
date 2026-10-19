# Clones

A clone is Claude Code or Codex that works for you while you are away. You start it with a task, and it works as you, with your skills, on your own subscription or key. It opens a draft pull request with your name on it and stops when CI is green.

Each clone runs in a fresh Docker container on a machine that you own. That can be your laptop, a spare machine, or a cloud VM. There is no shadowclone server, and your tokens stay in a file on that machine.

```text
$ shadowclone clone start --repo you/app "fix the flaky date parser test"
Queued clone k3x9m2qa for you/app: fix the flaky date parser test
$ shadowclone clone list
k3x9m2qa working you/app shadowclone/k3x9m2qa - 2026-10-18T13:40:02Z fix the flaky date parser test
```

Clones are separate from the [Actions bot](actions-bot.md). The bot runs in GitHub Actions on an API key, and anyone with write access can tag it.

| Mode        | Runs on                     | Model login                 | Who starts it                   | Commits show |
| ----------- | --------------------------- | --------------------------- | ------------------------------- | ------------ |
| Actions bot | GitHub Actions              | An API key                  | Anyone with write access        | The bot      |
| Clones      | Docker on a machine you own | Your subscription, or a key | You, from the CLI or your agent | You          |

## Set up with your agent

Ask your agent in the repository checkout, on the machine that runs the clones:

```text
Set up shadowclone clones for this repository with my Claude subscription.
```

The agent uses the `setup-clones` skill. You answer two questions, approve the skill files and the default branch ruleset, and paste your tokens into the secrets file. The agent runs a check and tells you how to start your first clone. Setup takes about 5 minutes.

Without an agent, run the same steps in a terminal:

```bash
shadowclone clone setup --repo owner/repository
shadowclone clone secrets --repo owner/repository
shadowclone clone status --repo owner/repository
```

Setup pushes your equipped skills to your private repository `<you>/shadowclone-skills` first, after you approve the file list. It also installs `shadowclone serve` as a launchd agent on macOS or a systemd user service on Linux. That service starts the clones.

## Choose a login

| Provider               | Agent       | Secret                                              | Notes                                                                                   |
| ---------------------- | ----------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `claude-subscription`  | Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` | The default. A Pro or Max plan. The token lasts one year                                |
| `anthropic`            | Claude Code | `ANTHROPIC_API_KEY`                                 |                                                                                         |
| `chatgpt-subscription` | Codex       | None                                                | Run `shadowclone clone login`. Refused on a public repository. One clone at a time      |
| `openai`               | Codex       | `OPENAI_API_KEY`                                    |                                                                                         |
| `openai-compatible`    | Codex       | `OPENAI_COMPATIBLE_API_KEY`                         | Needs `--base-url https://...` and `--model`. The endpoint must serve the Responses API |
| `ollama`               | Codex       | `OLLAMA_API_KEY`, only if your server needs one     | Needs `--base-url` and `--model`                                                        |
| `foundry`              | Codex       | `AZURE_OPENAI_API_KEY`                              | Needs `--base-url https://<resource>.openai.azure.com/openai/v1` and `--model`          |

Every clone also needs `GH_TOKEN`: a fine-grained token that covers the repository and `<you>/shadowclone-skills`. Give it read and write access to contents, issues, and pull requests, and read access to actions. Setup prints a link that fills in these settings. Reviews do not support `ollama` and `foundry` yet.

Anthropic allows you to sign in to the unmodified Claude Code with your own subscription where a platform hosts it. OpenAI asks you to use one ChatGPT login from one job stream at a time, and not on public repositories. So a ChatGPT login runs one clone at a time.

## Start a clone

- `shadowclone clone start --repo owner/repository "<task>"` works on a new branch, `shadowclone/<id>`.
- `--issue <number>` works on that issue, on the branch `shadowclone/issue-<number>`. With no task, the clone does the work that the issue describes.
- `--pull <number>` continues the work on that pull request's branch. A clone cannot push to a fork.
- `--review <number>` posts a review of that pull request as you.

From an agent with the shadowclone MCP tools, ask for a clone in plain words. The agent calls `shadowclone_clone` with your task or the plan that you approved. `shadowclone_sessions` lists the clones. See the [MCP guide](mcp.md).

`shadowclone serve` starts up to 2 clones at a time, oldest first. The others wait in the queue. A clone works for up to 170 minutes. It watches the CI of its pull request and fixes each failure before it stops.

## Follow and stop clones

- `shadowclone clone list` shows each clone with its state, branch, and pull request.
- `shadowclone clone show <id>` shows the task and the recent events.
- `shadowclone clone logs <id>` prints the end of the container log.
- `shadowclone clone stop <id>` stops a clone. A running clone first commits its unfinished work and pushes it to its branch. A queued clone never starts.

The states are `queued`, `working`, `done`, `failed`, `limited` (the model login reached a usage limit), and `stopped`.

## What a clone can do

A clone works as you, through your fine-grained token. Its commits and pull requests show your name. Three markers show the agent's part:

- The `shadowclone` label on the pull request.
- The line "Made by a shadowclone clone for @you." in the pull request body.
- A `Co-authored-by` trailer for Claude or Codex on each commit. Setup with `--no-attribution` turns off the trailer.

A clone never pushes to the default branch. A git hook refuses the push. Setup also adds the ruleset `shadowclone sessions default branch`. With it, every change to the default branch goes through a pull request, with no bypass for anyone, including you. In an organization, the ruleset applies to every member.

A review runs the repository's toolchain only on a pull request that you wrote in this repository. For a fork or a pull request from another person, the review runs none of its code and turns off web search.

Each repository has a daily limit of 20 clones, and one issue or pull request has one active clone at a time.

## Stop and remove

1. To stop all clones, stop the service: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/dev.shadowclone.sessions.plist` on macOS, or `systemctl --user disable --now shadowclone-sessions.service` on Linux.
2. To remove the setup, delete `~/.shadowclone/clones/`, the ruleset, and the fine-grained token. Run `docker volume rm shadowclone-codex-login` if you used a ChatGPT login.

The run folders in `~/.shadowclone/clones/runs/` keep each task, its events, and its container log. `shadowclone serve` removes a finished run folder after 30 days.

## Upgrade from cloud sessions

Clones replace cloud sessions. A `/shadowclone` comment no longer starts work, and the Cloudflare, Vercel, Modal, Daytona, and E2B hosts are gone.

1. Run `shadowclone clone setup --repo owner/repository` again. A saved setup from an earlier version does not load.
2. If you used a cloud host, delete its deployment and the repository webhook that setup added.

The refs under `refs/shadowclone/` and the status comments of earlier sessions stay in the repository. Nothing reads them anymore, so you can delete them.
