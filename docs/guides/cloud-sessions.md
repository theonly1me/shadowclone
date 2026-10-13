# Cloud sessions

A cloud session is Claude Code or Codex working for you while you are away. You comment `/shadowclone <task>` on a GitHub issue, and the session works as you, with your skills, on your own subscription or key. It opens a draft pull request with your name on it. Only your own comment starts a session.

Each session runs in an account that you own. Choose Cloudflare, Vercel, Modal, Daytona, E2B, or a spare machine with Docker. shadowclone has no server, and your tokens stay in your accounts.

```text
you        /shadowclone fix the flaky date parser test
session    shadowclone session is working on this.  Branch shadowclone/issue-42 | Claude Code
session    shadowclone session finished.  Pull request #43
```

Cloud sessions are separate from the [cloud bot](cloud-bot.md). The bot runs in GitHub Actions on an API key, and anyone with write access can tag it.

| Mode           | Runs on                         | Model login                 | Who starts it            | Commits show |
| -------------- | ------------------------------- | --------------------------- | ------------------------ | ------------ |
| Cloud bot      | GitHub Actions                  | An API key                  | Anyone with write access | The bot      |
| Cloud sessions | Your cloud account or a machine | Your subscription, or a key | Only you                 | You          |

## Set up with your agent

Ask your agent in the repository checkout:

```text
Set up shadowclone cloud sessions for this repository on Cloudflare with my Claude subscription.
```

The agent uses the `setup-cloud-sessions` skill. You answer three questions, approve the skill files and the default branch ruleset, and sign in to the host if it asks. Then you run one command that asks for your tokens:

```bash
shadowclone session secrets --repo owner/repository
```

The agent runs a check and tells you when to post your first `/shadowclone` comment.

Without an agent, run the same steps in a terminal:

```bash
shadowclone session setup --repo owner/repository --host cloudflare
shadowclone session secrets --repo owner/repository
shadowclone session status --repo owner/repository
```

Setup pushes your equipped skills to your private repository `<you>/shadowclone-skills` first, after you approve the file list.

## Choose where sessions run

| Host         | What setup deploys                                  | What you need                                                  | Notes                                                                            |
| ------------ | --------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `cloudflare` | A Worker and a Container (2 vCPU, 8 GiB)            | Workers Paid ($5 a month), `wrangler login`, Docker for deploy | Recommended. Cloudflare can restart a container. The session then saves its work |
| `vercel`     | A Function and Vercel Sandbox                       | `vercel login`, Docker for the first deploy                    | A 3-hour session needs Pro. Hobby stops a sandbox at 45 minutes                  |
| `modal`      | A Python endpoint and Modal Sandboxes               | The Modal CLI (`pip install modal`) and `modal setup`          | Modal includes $30 of compute each month                                         |
| `daytona`    | Sandboxes from a Daytona snapshot                   | A Daytona API key, and `--receiver`                            | The receiver runs in Cloudflare, Vercel, Supabase, or Deno Deploy                |
| `e2b`        | Sandboxes from an E2B template                      | An E2B API key, `e2b auth login`, and `--receiver`             | A 3-hour session needs E2B Pro                                                   |
| `local`      | A `shadowclone serve` service and Docker containers | A spare machine with Docker that stays on                      | Free. Run setup on that machine                                                  |

A receiver is the small function that gets GitHub's events. It checks the signature and your user ID, and it starts a sandbox. Cloudflare, Vercel, and Modal use their own receiver. Daytona and E2B use a receiver that you choose with `--receiver cloudflare`, `vercel`, `supabase` (with `--supabase-project <ref>`), or `deno` (with `--deno-org <name>`). On Deno Deploy, the receiver starts the sandbox before it answers GitHub, so E2B fits it best.

The `local` host polls GitHub every 60 seconds and needs no receiver. Setup installs the service as a launchd agent on macOS or a systemd user service on Linux.

## Choose a login

| Provider               | Agent       | Secret                                              | Notes                                                                                   |
| ---------------------- | ----------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `claude-subscription`  | Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` | The default. A Pro or Max plan. The token lasts one year                                |
| `anthropic`            | Claude Code | `ANTHROPIC_API_KEY`                                 |                                                                                         |
| `chatgpt-subscription` | Codex       | None                                                | Only on `local`. Run `shadowclone session login`. Refused on a public repository        |
| `openai`               | Codex       | `OPENAI_API_KEY`                                    |                                                                                         |
| `openai-compatible`    | Codex       | `OPENAI_COMPATIBLE_API_KEY`                         | Needs `--base-url https://...` and `--model`. The endpoint must serve the Responses API |
| `ollama`               | Codex       | `OLLAMA_API_KEY`, only if your server needs one     | Needs `--base-url` and `--model`                                                        |
| `foundry`              | Codex       | `AZURE_OPENAI_API_KEY`                              | Needs `--base-url https://<resource>.openai.azure.com/openai/v1` and `--model`          |

Every session also needs `GH_TOKEN`: a fine-grained token that covers the repository and `<you>/shadowclone-skills`. Give it read and write access to contents, issues, and pull requests, and read access to actions. Setup prints a link that fills in these settings. Reviews do not support `ollama` and `foundry` yet.

Anthropic allows you to sign in to the unmodified Claude Code with your own subscription where a platform hosts it. OpenAI asks you to use one ChatGPT login from one machine at a time, and not on public repositories. So the ChatGPT login works only on a spare machine.

## Start a session

- `/shadowclone <task>` on an issue starts work on the branch `shadowclone/issue-<number>`. The session opens a draft pull request.
- `/shadowclone <task>` on a pull request continues work on its branch.
- `/shadowclone` with no task does the work that the issue or pull request describes.
- `/shadowclone review` on a pull request posts a review as you.
- `shadowclone session start --repo owner/repository --issue 12 "fix the parser"` posts the comment for you.

The command must be the first line of a comment that you wrote. A comment from anyone else starts nothing, even if it copies the command. While a session works on an issue or pull request, a new command or a CI result there starts nothing. The agent comments with your name too.

The session reacts with eyes and keeps one status comment on the issue or pull request. The status comment says when the session works, finishes, stops, or reaches a usage limit. `shadowclone session list --repo owner/repository` reads these comments.

When the CI runs on the commit that the session pushed last finish, the session continues. A review from an allowed reviewer bot also continues it. The defaults are `coderabbitai[bot]` and `github-actions[bot]`. If you push to the branch yourself, CI on your commit does not continue the session.

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
2. To stop all sessions, delete the repository webhook that setup added, or stop the `local` service: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/dev.shadowclone.sessions.plist` on macOS, or `systemctl --user disable --now shadowclone-sessions.service` on Linux.
3. To remove the setup, delete the host deployment, `~/.shadowclone/clones/`, the ruleset, and the fine-grained token. Run `docker volume rm shadowclone-codex-login` if you used a ChatGPT login.

GitHub keeps the claim refs under `refs/shadowclone/` for up to two days, and the session refs until you delete them.
