# Cloud bots

A cloud bot is Claude Code that runs in GitHub Actions on your repository, with your engineering skills. It works on issues, answers mentions, and reviews pull requests. You review and merge each PR.

The bot is a **machine account**: a GitHub account that you create and name, such as `octo-shadow`. It has its own profile, and its merged commits count on its contribution graph. GitHub's terms allow one free machine account for each person. A personal GitHub App is the second option, for people who do not want a second account.

## Set up a machine account bot

Ask your agent, "set up shadowclone cloud for this repository with the bot octo-shadow". The agent calls the `shadowclone_bot` MCP tool. You can also run this in the repository checkout:

```bash
shadowclone bot setup --bot octo-shadow
```

You need GitHub CLI signed in with `gh auth login`, administration access to the repository, and an active Shadowclone skills environment.

1. If the account does not exist, setup opens the GitHub signup page. Create the account, then run setup again.
2. Setup lists the skill files that it will push to your private repository `<you>/shadowclone-skills`. Approve them. The agent asks you before it approves.
3. Setup protects the default branch, pushes the skills, adds a read-only deploy key, invites the bot, and opens the setup pull request.
4. Setup opens the GitHub pages for the steps that need you:
   1. Sign in as the bot, and create a classic token with only the `repo` scope.
   2. On the environment page, add that token as `SHADOWCLONE_BOT_TOKEN`.
   3. Run `claude setup-token` in a terminal, and add the token as `CLAUDE_CODE_OAUTH_TOKEN`.
5. Merge the setup pull request.
6. Mention the bot once, for example on a small issue. Its first run accepts the repository invitation.

Shadowclone never reads your tokens. You enter them on GitHub. `shadowclone bot status --repo owner/repository` lists the steps that are still open. It reads secret names, never their values. The terminal setup checks again every 15 seconds and says when each step is done.

To update your skills later, run setup again. It pushes only changed files and replaces the deploy key.

## Set up a GitHub App bot

Run `shadowclone bot setup` without `--bot`, and choose **Use a GitHub App instead** in the browser. Review the skill files, register and name the App, and install it with **Only select repositories**. Setup uploads the App key, which it created, and opens the setup pull request. Add `CLAUDE_CODE_OAUTH_TOKEN` on the environment page, then merge the pull request.

Setup rejects an App installed on **All repositories**. A private App can be installed only on its owning account. For an organization repository, the App registration runs under that organization.

## Work on issues and PRs

Create an issue as the installing owner. Its stated scope authorizes a plan, changes, checks, commits, pushes, and a PR. The clone opens the PR as a draft and marks it ready for review when its checks pass, it has no conflicts, and every review thread is handled. Scope expansion still needs your decision.

Mention the bot with a request on an issue or a same-repository PR: `@octo-shadow` for a machine account, or `@shadowclone` and the App slug for an App. External users, fork PRs, and the bot's own comments cannot start work.

When the worker accepts a request, it reacts with `eyes` as the clone. The reaction goes on the tagged comment, or on the issue for a new issue. A review body or a CI-started run has no reaction. A failed reaction logs a warning and the work continues.

The clone follows the exported `shadowclone-work` skill and native engineering rules. It repairs checks, conflicts, and valid reviewer findings before it marks the PR ready. It reports a check that waits for a human and does not retrigger it. Each run has a 20-minute limit and 60 turns. Each branch has a daily limit of ten worker runs. A run can stop before the finish line; inspect its Actions result before requesting another attempt.

When the last GitHub Actions run on a managed PR's head finishes, the clone resumes that PR once, also after its own pushes. Approved reviewer events can resume it too. The default reviewer bot list contains `coderabbitai[bot]` and `github-actions[bot]`. Review findings from repository writers also qualify. To change requesters, reviewers, or limits, review both workflow configurations in a PR.

A fixed finding gets a reply with only its commit hash. The clone resolves fixed bot threads and leaves fixed human threads open. A declined finding gets no reply and stays open. You merge the PR. The clone never merges, releases, or force pushes.

## Review pull requests

Comment `@<bot> review` as the first line of a comment on a same-repository pull request, or run `shadowclone review <pr> --cloud`. A pull request that a requester opens or marks ready for review gets a review without a comment. The clone posts one review with event `COMMENT`. See [pull request reviews](reviews.md) for what it checks.

A review runs in five jobs. Only the publish job holds the App token. The toolchain job runs the pull request's code with no secrets. The model job holds only the Claude token and never runs that code. `reviewModel` in both workflow configurations chooses the model, and it defaults to `claude-opus-5-5`. `reviewNetwork` set to `false` turns off web search and page fetches for reviews. Reviews count toward the daily branch limit.

A clone that was set up before reviews existed needs updated workflows. `shadowclone review <pr> --cloud` opens a draft pull request with them. Merge it before you ask for a review.

## Continue locally

1. Add `shadowclone:paused` to the issue or PR.
2. Confirm the active Shadowclone workflow stops in GitHub Actions.
3. Run `gh pr checkout <number>` in your local checkout.
4. Make and push your changes.
5. Remove `shadowclone:paused` when the clone can continue.

A pause on the original issue also blocks its issue branch. The worker checks pause state again after queuing. Its prompt requires another check before writes. Cancellation and instruction checks do not make an in-flight GitHub write atomic.

## Skills and credentials

The bot reads your skills and native rules from the private repository `<you>/shadowclone-skills`, with a read-only deploy key for each target repository. There is no size limit. The files pass Shadowclone's redaction and path checks before setup pushes them.

The `shadowclone` environment holds `SHADOWCLONE_BOT_TOKEN` or the App key, `CLAUDE_CODE_OAUTH_TOKEN`, and `SHADOWCLONE_SKILLS_KEY`. Only the default branch can use the environment. Setup keeps an existing environment's approval settings and rejects broader branch policies. Your GitHub plan must support environments and environment secrets for the repository.

The environment still trusts its default-branch workflows and the code that runs with its secrets. The bot token or the App token reaches the coding agent for Git and GitHub actions, and the agent can run any shell command on the runner. A machine account token has no `workflow` scope, so the bot cannot change workflows. It reaches every repository that the bot is invited to, so invite the bot only to the repositories that it works on.

Before it adds any secret, setup adds the `shadowclone default branch` ruleset. It restricts updates and deletion of the default branch:

- With an App, the admin, maintain, and write roles are exempt. The App cannot push to the default branch or merge into it.
- With a machine account, only the admin and maintain roles are exempt, because the bot has the write role. In an organization repository, write-role members then need an admin or a maintainer to merge.

Workflows that push to the default branch with `GITHUB_TOKEN` stop working, because GitHub Actions is not on the exemption list. Setup stops if a ruleset with that name has other settings.

`shadowclone bot export --skill shadowclone-work --skill shadowclone-baseline --output <private-folder>` writes the skills to a folder outside the checkout. It makes no upload.

## Stop and remove

Pause current work, cancel any remaining Actions run, and remove the two Shadowclone workflows and `.github/shadowclone/` through a reviewed PR. Delete the secrets from the `shadowclone` environment, the `shadowclone default branch` ruleset, and the deploy key on your skills repository. Remove the bot from the repository's collaborators, or uninstall or delete the App on GitHub. Remove local metadata under `~/.shadowclone/cloud/installations/` if it is no longer needed.

Closing the setup server removes its in-memory preview and App registration credentials. Exported folders and your skills repository remain until you delete them. GitHub and the selected provider apply their own retention policies to cloud runs and repository content.
