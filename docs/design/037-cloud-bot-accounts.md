# Cloud bot accounts and setup on GitHub

## Problem

Cloud setup took many steps in a local browser wizard. The owner registered a GitHub App, pasted the Claude token into a Shadowclone page, and selected skills that had to fit in one GitHub secret. A secret holds at most 48 KB, so a larger set of skills could not reach the cloud. The bot also had no profile of its own: an App bot has no contribution graph, and people cannot mention it like a person.

## Decision

A cloud bot can be a **machine account**: a real GitHub account that the owner creates and names, such as `octo-shadow`. GitHub's terms allow one free machine account for each person. The personal GitHub App from [031](031-github-clones.md) stays as a second identity.

**Tokens stay on GitHub.** Setup creates the `shadowclone` environment, limited to the default branch, and opens its page. The owner adds each token there:

- `SHADOWCLONE_BOT_TOKEN` is a classic token with `repo` scope, made while signed in as the bot. It has no `workflow` scope, so the bot cannot change workflows.
- `CLAUDE_CODE_OAUTH_TOKEN` comes from `claude setup-token`.

Shadowclone never reads either token. In App mode, setup still uploads the App key that the manifest flow returns, because Shadowclone creates that key.

**Skills live in a private repository.** Setup creates `<owner>/shadowclone-skills` as a private repository and shows the files that it will push. After one approval, it pushes them through the GitHub API. The files are the same plugin tree that the earlier secret held: the marketplace, the `shadowclone-personal` plugin with each skill, and `native.md`.

Setup makes a read-only deploy key on the skills repository for each target repository. It stores the private half as `SHADOWCLONE_SKILLS_KEY` in the target's environment. The worker checks out the skills repository with that key, so there is no size limit, and running setup again updates the skills.

**Setup is a checklist.** `shadowclone bot setup --bot <login>` and the MCP tool `shadowclone_bot` do each step that the owner's `gh` login can do:

1. Check administration access and the local checkout.
2. Invite the bot with write access.
3. Protect the default branch.
4. Create the environment.
5. Push the skills and add the deploy key.
6. Open the setup PR.

For each step that needs the owner, setup opens one GitHub page:

- the signup page, when the bot does not exist yet
- the token page for the bot
- the environment page for the two tokens
- the setup PR

`status` reads the names of the environment secrets, never their values. It also reads the PR state and the invitation, and it lists what is still missing. The first worker run accepts the repository invitation with the bot token.

**The workflows choose the token by identity.** In account mode, every job that writes uses `SHADOWCLONE_BOT_TOKEN`, and the action commits as the bot. Its email is `<id>+<login>@users.noreply.github.com`, so merged commits count on the bot's profile. In App mode, the jobs mint an App token as before. A mention is `@<login>` in account mode. In App mode, `@shadowclone` and the App slug both work.

**The default branch stays protected.** The `shadowclone default branch` ruleset restricts updates and deletion of the default branch. In App mode, it exempts the admin, maintain, and write roles, as before. In account mode, the bot has the write role, so the ruleset exempts only the admin and maintain roles. In a personal repository, only the owner can update the default branch. In an organization repository, write-role members need an admin or a maintainer to merge, and setup says so.

## Consequences

- The owner creates a second GitHub account once, with its own email. GitHub can ask for 2FA. A paid organization charges a seat for it.
- The bot token reaches every repository that the bot is invited to. Setup invites it only to the target repository.
- An installation from an earlier version has no skills repository. Its `--cloud` request asks the owner to run setup again.
- The 48 KB limit and the guidance secret are removed.

## Verification

- Tests cover these areas:
  - the rendered workflows in each mode: tokens, the skills checkout, and no guidance secret
  - the ruleset bypass in each mode
  - the checklist from secret names, the PR state, and the invitation
  - the skills push and the deploy key, with a fake `gh`
  - an export larger than 48 KB
- `actionlint` accepts the rendered workflows.
- A live setup with a machine account on a private repository: the owner adds the tokens on GitHub, merges the setup PR, and `@<bot>` on an issue opens a PR with commits by the bot.

## Data handling

The skills and native rules go to a private repository that the owner owns. The same redaction and path checks as before apply to them. Tokens go from the owner's browser to GitHub. Shadowclone keeps only installation metadata under `~/.shadowclone/cloud/installations/`.
