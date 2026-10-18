# GitHub Actions bot

An Actions bot is a coding agent that runs in GitHub Actions on your repository, with your engineering skills. People with write access tag it on issues and pull requests. It works on issues, answers tags, and reviews pull requests. You merge. Live installation qualification is pending.

The bot is a **machine account**: a GitHub account that you create and name, such as `octo-shadow`. GitHub allows one free machine account for each person. The bot runs on one provider API key that you add on GitHub.

To use your own Claude or ChatGPT subscription, use [clones](clones.md) instead. They run on a machine that you own, and only you can start them.

## Set up the bot

Ask your agent: "Set up the shadowclone Actions bot here with the account octo-shadow." The agent calls the `shadowclone_bot` MCP tool. Or run this in the checkout:

```bash
shadowclone bot setup --bot octo-shadow
```

You need the GitHub CLI (`gh auth login`), administration access to the repository, and an active shadowclone skills environment.

1. If the account does not exist, setup opens the GitHub signup page. Create the account, then run setup again.
2. Approve the skill files that setup pushes to your private repository `<you>/shadowclone-skills`. An agent must ask you first. If a skill in your build has no copy on this machine, setup leaves it out and names it.
3. Setup protects the default branch, pushes the skills, and adds a read-only deploy key. Then it invites the bot and opens the setup pull request.
4. Setup prints one link to the `shadowclone` environment page, and the pages that create each secret.
5. On the environment page, add `SHADOWCLONE_BOT_TOKEN` and the API key of your provider. Make the bot token while you are signed in as the bot: a classic token with only the `repo` scope.
6. Merge the setup pull request.
7. Run `shadowclone bot status --repo owner/repository`.

The status command starts a check run. The run accepts the repository invitation as the bot and confirms the API key with one small request. The command prints the run link, or the step that failed. shadowclone never reads your secrets. To update your skills, run setup again. It pushes only changed files and replaces the deploy key.

## Choose a provider

Add `--provider` to setup. The default is `anthropic`.

| Provider            | Secret                      | Agent            | Notes                                                                                          |
| ------------------- | --------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `anthropic`         | `ANTHROPIC_API_KEY`         | Claude Code      | Runs through Anthropic's `claude-code-action`                                                  |
| `openai`            | `OPENAI_API_KEY`            | Codex            |                                                                                                |
| `openai-compatible` | `OPENAI_COMPATIBLE_API_KEY` | Codex            | Needs `--base-url https://...` and `--model`. The endpoint must serve the OpenAI Responses API |
| `cursor`            | `CURSOR_API_KEY`            | Cursor Agent CLI | Installs a pinned Cursor CLI and checks its SHA-256 digest                                     |

`--model <id>` chooses the model for work and reviews. Without it, reviews use `claude-opus-5-5` for Anthropic, `gpt-6.1-sol` for OpenAI, and the Cursor default for Cursor. Work uses the default model of each agent.

The bot uses API keys only. Anyone with write access can spend the key, so set a spending limit in your provider console.

## Work on issues and pull requests

Tag the bot in an issue title, an issue body, or a comment: `@octo-shadow fix the parser`. The person who tags it must have the write, maintain, or admin role on the repository. The bot does nothing in a repository that it does not belong to.

The issue's stated scope lets the bot plan, change files, run checks, commit, push, and open a draft pull request. The bot marks the pull request ready when checks pass, it has no conflicts, and every review thread has an answer. A larger scope needs your decision. The bot cannot work on a pull request from a fork, because it cannot push to a fork. Other bots and the bot's own comments cannot start work.

- It reports a check that waits for a human, and it does not run that check again.
- A run works for up to 3 hours. When it stops, its last step commits the remaining changes as the bot and pushes them to the work branch, unless the request is paused.
- Each branch has a daily limit of 10 worker runs, and the repository has a daily limit of 100.

When the last Actions run on the head of a managed pull request finishes, the bot continues the work once. Events from approved reviewers can continue it too. The default reviewers are `coderabbitai[bot]` and `github-actions[bot]`, and comments from people with write access count. To change the reviewers or the limits, edit both workflow configurations in a reviewed pull request.

The bot answers review threads as [delegated work](delegated-work.md#review-comments) describes. It never merges or releases.

## Review pull requests

Comment `@octo-shadow review` as the first line on a pull request. The bot posts one review with the event `COMMENT`. A pull request that opens gets no review until someone tags the bot. [Reviews](reviews.md) lists the checks.

A review runs in five jobs. Only the acknowledge and publish jobs hold the bot token. The toolchain job runs the pull request code with no secrets. The model job holds only the API key and never runs that code.

A pull request from a fork also gets a review when someone with write access tags the bot. For a fork, the review skips the toolchain job and turns off web search and page fetches. So no code from the fork runs, and the model cannot send data out.

`reviewNetwork: false` in both workflow configurations turns off web search and page fetches for every review. Reviews count toward the daily branch limit.

## Continue locally

1. Add the label `shadowclone:paused`. It blocks dispatch and cancels matching worker runs.
2. Run `gh pr checkout <number>`, then make and push your changes.
3. Remove the label when the bot can continue.

A pause on the issue also blocks its issue branch. The worker checks the pause state again after it queues and before each write. A cancellation does not make an in-flight write atomic.

## Skills and credentials

The bot reads your skills and native rules from the private repository `<you>/shadowclone-skills`, with a read-only deploy key for each target repository. Setup redacts and path-checks the files first. The bundle is frozen, so later local changes do not update it.

The `shadowclone` environment holds `SHADOWCLONE_BOT_TOKEN`, the provider API key, and the deploy key `SHADOWCLONE_SKILLS_KEY`. Only the default branch can use it. Setup keeps existing approval settings and rejects broader branch policies. Your GitHub plan must support environment secrets.

The environment trusts its default-branch workflows and the code that runs with its secrets. The coding agent gets the bot token and can run any shell command on the runner. The bot token has no `workflow` scope, and it reaches every repository that you invite the bot to. Invite the bot only to repositories that it works on.

Before it adds a secret, setup adds the `shadowclone default branch` ruleset, which restricts updates and deletion of the default branch. Only the admin and maintain roles are exempt. The bot has the write role, so it cannot update the default branch. In an organization repository, write-role members need an admin or a maintainer to merge. Workflows that push to the default branch with `GITHUB_TOKEN` stop working, because GitHub Actions is not exempt. If a ruleset with that name has other settings, setup stops and links to it.

`shadowclone bot export --skill shadowclone-work --skill shadowclone-baseline --output <private-folder>` saves the skills to a folder outside the checkout. It uploads nothing.

## Stop and remove

1. Pause the work and cancel the remaining Actions runs.
2. Remove the three shadowclone workflows and `.github/shadowclone/` in a pull request.
3. Delete the environment secrets, the ruleset, and the deploy key on your skills repository.
4. Remove the bot from the collaborators.
5. Remove `~/.shadowclone/cloud/installations/` if you do not need it.

Exported folders and your skills repository stay until you delete them. GitHub and the provider apply their own retention policies.
