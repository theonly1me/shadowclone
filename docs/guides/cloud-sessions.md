# Cloud sessions

A cloud session is Claude Code or Codex working for you on a spare machine that you own. You comment `/shadowclone <task>` on a GitHub issue or pull request, and the session works as you, with your skills, on your own subscription or key. Only your own comment starts a session. There is no bot account and no shadowclone server.

Cloud sessions are separate from the [cloud bot](cloud-bot.md). The bot runs in GitHub Actions on an API key, and anyone with write access can tag it.

| Mode           | Runs on                    | Model login                 | Who starts it            | Commits show |
| -------------- | -------------------------- | --------------------------- | ------------------------ | ------------ |
| Cloud bot      | GitHub Actions             | An API key                  | Anyone with write access | The bot      |
| Cloud sessions | Your spare machine, Docker | Your subscription, or a key | Only you                 | You          |

## Set up a spare machine (10 minutes)

You need Docker (Docker Desktop, OrbStack, or Docker Engine), the GitHub CLI signed in as you, and administration access to the repository.

1. On your main machine, ask your agent: "Push my shadowclone skills for cloud sessions." The agent shows the files. After you agree, it pushes them to your private repository `<you>/shadowclone-skills`.
2. On the spare machine, install the shadowclone CLI and its plugin, and open Claude Code or Codex.
3. Ask: "Set up shadowclone cloud sessions here for owner/repository with my Claude subscription."
4. Approve the default branch ruleset when the agent shows it.
5. Paste the tokens into `~/.shadowclone/clones/secrets.env` in an editor. Never paste them into chat.
6. Tell the agent that you are done. It runs a check in Docker and reports each line.

Without an agent, run the same steps in a terminal:

```bash
shadowclone session skills                 # on the main machine, in the checkout
shadowclone session setup --repo owner/repository --provider claude-subscription
shadowclone session status --repo owner/repository
```

Setup installs `shadowclone serve` as a launchd service on macOS or a systemd user service on Linux. The service polls GitHub every 60 seconds and runs one session at a time. The machine must stay on and awake.

## Choose a login

| Provider               | Agent       | Secret in `secrets.env`                             | Notes                                                                                    |
| ---------------------- | ----------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `claude-subscription`  | Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` | The default. A Pro or Max plan. The token lasts one year                                 |
| `anthropic`            | Claude Code | `ANTHROPIC_API_KEY`                                 |                                                                                          |
| `chatgpt-subscription` | Codex       | None                                                | Run `shadowclone session login`, and enter the code. Refused on a public repository      |
| `openai`               | Codex       | `OPENAI_API_KEY`                                    |                                                                                          |
| `openai-compatible`    | Codex       | `OPENAI_COMPATIBLE_API_KEY`                         | Needs `--base-url https://...` and `--model`. The endpoint must serve the Responses API  |
| `ollama`               | Codex       | `OLLAMA_API_KEY`, only if your server needs one     | Needs `--base-url` and `--model`. `http://host.docker.internal:11434/v1` is this machine |
| `foundry`              | Codex       | `AZURE_OPENAI_API_KEY`                              | Needs `--base-url https://<resource>.openai.azure.com/openai/v1` and `--model`           |

Every provider also needs `GH_TOKEN`: a fine-grained token that covers the repository and `<you>/shadowclone-skills`. Give it read and write access to contents, issues, and pull requests, and read access to actions. Setup prints a link that fills in these settings. Reviews do not support `ollama` and `foundry` yet.

Anthropic allows you to sign in to the unmodified Claude Code with your own subscription on a machine that you control. OpenAI asks you to use one ChatGPT login from one machine at a time, and not on public repositories. The ChatGPT login stays in a Docker volume on the spare machine.

## Start a session

- `/shadowclone <task>` on an issue starts work on the branch `shadowclone/issue-<number>`. The session opens a draft pull request.
- `/shadowclone <task>` on a pull request continues work on its branch.
- `/shadowclone` with no task does the work that the issue or pull request describes.
- `/shadowclone review` on a pull request posts a review as you.
- `shadowclone session start --repo owner/repository --issue 12 "fix the parser"` posts the comment for you, from any machine.

The command must be the first line of a comment that you wrote. A comment from anyone else starts nothing, even if it copies the command.

The session reacts with eyes and keeps one status comment on the issue or pull request. The status comment says when the session works, finishes, stops, or reaches a usage limit. `shadowclone session list --repo owner/repository` reads these comments, and `shadowclone session logs` shows the last log on the spare machine.

When the CI runs on the commit that the session pushed last finish, the session continues once. A review from an allowed reviewer bot also continues it. The defaults are `coderabbitai[bot]` and `github-actions[bot]`. If you push to the branch yourself, CI on your commit does not continue the session.

## What a session can do

A session works as you, through your fine-grained token. Its commits and pull requests show your name. Three markers show the agent's part:

- The `shadowclone` label on the pull request.
- The line "Made in a shadowclone session for @you." in the pull request body.
- A `Co-authored-by` trailer for Claude or Codex on each commit. Setup with `--no-attribution` turns off the trailer.

A session never pushes to the default branch. A git hook refuses the push. Setup also adds the ruleset `shadowclone sessions default branch`. With it, every change to the default branch goes through a pull request, with no bypass for anyone, including you. In an organization, the ruleset applies to every member.

A review runs the repository's toolchain only on a pull request that you wrote in this repository. For a fork or a pull request from another person, the review runs none of its code and turns off web search.

Each branch has a daily limit of 10 sessions, and the repository has a daily limit of 100. A session works for up to 170 minutes. When it stops, it commits the remaining changes and pushes them to its branch.

## Pause and stop

1. Add the label `shadowclone:paused` to the issue or pull request. A paused issue or pull request starts no session. A running session reads the label before each push, and stops.
2. To stop all sessions on the machine, stop the service: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/dev.shadowclone.sessions.plist` on macOS, or `systemctl --user disable --now shadowclone-sessions.service` on Linux.
3. To remove the setup, delete `~/.shadowclone/clones/`, the ruleset, and the fine-grained token. Run `docker volume rm shadowclone-codex-login` if you used a ChatGPT login.

GitHub keeps the claim refs under `refs/shadowclone/` for up to two days, and the session refs until you delete them.
