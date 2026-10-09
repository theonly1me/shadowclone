# Cloud bot

A cloud bot is an agent that runs in GitHub Actions on your repository, with your engineering skills. The agent is Claude Code or Codex. The bot works on issues, answers mentions, and reviews pull requests. You review and merge each pull request.

The bot is a **machine account**: a GitHub account that you create and name, such as `octo-shadow`. It has its own profile, and its merged commits count on its contribution graph. GitHub allows one free machine account for each person. A personal GitHub App is the second option for people who do not want a second account.

Live installation qualification of the cloud bot is still pending.

## Set up a machine account bot

Ask your agent: "Set up shadowclone cloud for this repository with the bot octo-shadow." The agent calls the `shadowclone_bot` MCP tool. You can also run this command in the repository checkout:

```bash
shadowclone bot setup --bot octo-shadow
```

You need the GitHub CLI signed in with `gh auth login`, administration access to the repository, and an active Shadowclone skills environment.

1. If the account does not exist, setup opens the GitHub signup page. Create the account and run setup again.
2. Read the list of skill files that setup will push to your private repository `<you>/shadowclone-skills`. Approve the list. An agent must ask you before it approves.
3. Setup protects the default branch, pushes the skills, adds a read-only deploy key, invites the bot, and opens the setup pull request.
4. Setup opens the GitHub pages for the steps that need you. Sign in as the bot and create a classic token with only the `repo` scope. Add it to the `shadowclone` environment as `SHADOWCLONE_BOT_TOKEN`.
5. Add the secret for your agent to the same environment. Use the name in the next table.
6. Merge the setup pull request.
7. Mention the bot once, for example on a small issue. Its first run accepts the repository invitation.

| Agent                     | Secret                    | How to get it                                                    |
| ------------------------- | ------------------------- | ---------------------------------------------------------------- |
| Claude Code               | `CLAUDE_CODE_OAUTH_TOKEN` | Run `claude setup-token` in a terminal                           |
| Codex with an API key     | `OPENAI_API_KEY`          | Create a key in the OpenAI platform                              |
| Codex with a ChatGPT plan | `CODEX_AUTH_JSON`         | Run `codex login`, then copy the content of `~/.codex/auth.json` |

Shadowclone never reads your tokens. You enter them on GitHub. `shadowclone bot status --repo owner/repository` lists the steps that are still open. It reads secret names and never their values. The terminal setup checks every 15 seconds and says when each step is done.

To update your skills later, run setup again. It pushes only changed files and replaces the deploy key.

## Use Codex

Add `--engine codex` to the setup, or choose Codex in the browser. The bot then works and reviews with Codex, and the checklist asks for `OPENAI_API_KEY`. An API key bills for each token.

`--codex-auth plan` uses your ChatGPT plan instead. This option is experimental and needs a machine account bot. Each run stores the refreshed login back in `CODEX_AUTH_JSON`, and runs on the repository wait for each other. If you use the same login on another machine, add a fresh `auth.json` when the bot can no longer sign in.

A Codex review can read only the pull request checkout. It cannot read its own login or the secrets of the environment.

## Set up a GitHub App bot

Run `shadowclone bot setup` without `--bot`, and choose **Use a GitHub App instead** in the browser. Review the skill files, register and name the App, and install it with **Only select repositories**. Setup uploads the App key that it created and opens the setup pull request. Add the secret for your agent, then merge the pull request.

Setup rejects an App that you install on **All repositories**. You can install a private App only on its owning account. For an organization repository, the App registration runs under that organization.

## Work on issues and pull requests

Create an issue as the installing owner. Its stated scope lets the bot plan, change files, run checks, commit, push, and open a pull request. The bot opens the pull request as a draft. It marks the pull request ready when its checks pass, it has no conflicts, and every review thread has an answer. A larger scope needs your decision.

Mention the bot with a request on an issue or a same-repository pull request. A machine account answers to `@octo-shadow`. An App answers to `@shadowclone` and to its App slug. External users, fork pull requests, and the bot's own comments cannot start work.

When the worker accepts a request, it reacts with `eyes` as the bot. The reaction goes on the tagged comment, or on the issue for a new issue. A failed reaction logs a warning, and the work continues.

- The bot follows the exported `shadowclone-work` skill and your native engineering rules.
- It repairs checks, conflicts, and valid reviewer findings before it marks the pull request ready.
- It reports a check that waits for a human and does not run that check again.
- Each run can work for up to 3 hours. When a run stops, its last step commits the remaining changes as the bot and pushes them to the work branch. A paused request skips this step.
- Each branch has a daily limit of ten worker runs. A run can stop before it finishes, so read its Actions result before you ask for another attempt.

When the last GitHub Actions run on the head of a managed pull request finishes, the bot resumes that pull request once. This includes runs on its own pushes. Approved reviewer events can resume it too.

The default reviewer bots are `coderabbitai[bot]` and `github-actions[bot]`. Review findings from repository writers also count. To change requesters, reviewers, or limits, review both workflow configurations in a pull request.

A fixed finding gets a reply with only its commit hash. The bot resolves fixed bot threads and leaves fixed human threads open. A declined finding gets no reply and stays open. You merge the pull request. The bot never merges, releases, or force pushes.

## Review pull requests

Comment `@<bot> review` as the first line of a comment on a same-repository pull request. A pull request that a requester opens or marks ready for review gets a review without a comment. The bot posts one review with the event `COMMENT`. [Reviews](reviews.md) lists what it checks.

`shadowclone review <pr> --cloud` posts the comment `@shadowclone review`. Only an App bot answers to that name. For a machine account bot, comment `@<bot> review` yourself.

A review runs in five jobs:

- Only the acknowledge job and the publish job hold the bot token or the App token.
- The toolchain job runs the code of the pull request with no secrets.
- The model job holds only the Claude token or the Codex login and never runs that code.
- With a Codex plan login, only the last step gets the bot token, to store the refreshed login.

`reviewModel` in both workflow configurations chooses the model. It defaults to `claude-opus-5-5` for Claude and `gpt-6.1-sol` for Codex. Set `reviewNetwork` to `false` to turn off web search and page fetches. Reviews count toward the daily branch limit.

A bot that you created before reviews existed needs updated workflows. `shadowclone review <pr> --cloud` opens a draft pull request with them. Merge it before you ask for a review.

## Continue locally

1. Add the label `shadowclone:paused` to the issue or pull request.
2. Confirm that the active Shadowclone workflow stops in GitHub Actions.
3. Run `gh pr checkout <number>` in your local checkout.
4. Make and push your changes.
5. Remove the label `shadowclone:paused` when the bot can continue.

A pause on the original issue also blocks its issue branch. The worker checks the pause state again after it queues. Its prompt requires one more check before writes. A cancellation does not make a write that is already in flight atomic.

## Skills and credentials

The bot reads your skills and native rules from the private repository `<you>/shadowclone-skills`, with a read-only deploy key for each target repository. There is no size limit. The files pass the redaction and path checks of Shadowclone before setup pushes them.

The `shadowclone` environment holds these secrets:

- `SHADOWCLONE_BOT_TOKEN`, or `SHADOWCLONE_APP_PRIVATE_KEY` for an App.
- The secret for your agent: `CLAUDE_CODE_OAUTH_TOKEN`, `OPENAI_API_KEY`, or `CODEX_AUTH_JSON`.
- `SHADOWCLONE_SKILLS_KEY`, the deploy key for your skills repository.

Only the default branch can use the environment. Setup keeps the approval settings of an existing environment and rejects broader branch policies. Your GitHub plan must support environments and environment secrets for the repository.

The environment trusts its default-branch workflows and the code that runs with its secrets. The bot token or the App token reaches the coding agent for Git and GitHub actions.

The agent can run any shell command on the runner. A machine account token has no `workflow` scope, so the bot cannot change workflows. The token reaches every repository that you invite the bot to, so invite the bot only to the repositories that it works on.

Before setup adds a secret, it adds the `shadowclone default branch` ruleset. The ruleset restricts updates and deletion of the default branch.

- With an App, the admin, maintain, and write roles are exempt. The App cannot push to the default branch or merge into it.
- With a machine account, only the admin and maintain roles are exempt, because the bot has the write role. In an organization repository, members with the write role need an admin or a maintainer to merge.

Workflows that push to the default branch with `GITHUB_TOKEN` stop working, because GitHub Actions is not on the exemption list. Setup stops if a ruleset with that name has other settings.

To save the skills to a folder without an upload, run this command:

```bash
shadowclone bot export --skill shadowclone-work --skill shadowclone-baseline --output <private-folder>
```

The folder must be outside the repository checkout.

## Stop and remove

1. Pause the current work and cancel any remaining Actions run.
2. Remove the two Shadowclone workflows and `.github/shadowclone/` in a reviewed pull request.
3. Delete the secrets of the `shadowclone` environment, the `shadowclone default branch` ruleset, and the deploy key on your skills repository.
4. Remove the bot from the collaborators of the repository, or uninstall or delete the App on GitHub.
5. Remove the local metadata under `~/.shadowclone/cloud/installations/` if you no longer need it.

Closing the setup server removes its preview and App registration credentials from memory. Exported folders and your skills repository stay until you delete them. GitHub and the selected provider apply their own retention policies to cloud runs and repository content.
