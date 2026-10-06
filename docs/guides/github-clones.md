# Personal GitHub clones

A personal clone is a GitHub App that you name. A personal repository uses an App you own. An organization repository uses a private App owned by that organization. It runs the pinned Claude Code Action with your reviewed Shadowclone skills and Claude subscription. You review and merge its PRs.

This first version supports GitHub.com and Claude subscriptions. Cloud skill delivery passed a synthetic pilot. The complete App, issue, review, and local handoff flow still needs live qualification.

## Install

Install GitHub CLI and Claude Code. Sign in with `gh auth login`. Equip your maintained engineering skills and `shadowclone-work` with `shadowclone wizard`. Start in the repository checkout that the clone will use.

1. Run `shadowclone bot setup`.
2. Choose the clone name and review the selected skills. The list starts with `shadowclone-work` and the skills equipped in your build.
3. Preview every exported file and approve its cloud use.
4. Register the App on GitHub.
5. Install it with **Only select repositories** and include the reviewed repository.
6. Return to the original setup tab.
7. Run `claude setup-token` in your terminal and complete the Claude sign-in.
8. Paste the token into the password field and authorize subscription use.
9. Review and merge the generated setup PR when its configuration is correct.

The setup opens Safari on macOS. Keep the terminal open until setup finishes. `--no-open` prints the local link. `--repo owner/repository` fills the repository field. GitHub controls name availability and organization installation approval. An organization policy can require its owner to approve installation.

Ask an agent connected to Shadowclone MCP to start personal clone setup. The `shadowclone_bot` tool accepts `setup` and `status`. Registration, repository selection, guidance approval, and subscription authorization require your browser interaction.

Setup rejects an App installed on **All repositories**. It verifies the target repository ID and mints a token for that repository alone. The local checkout origin must match the selected repository. A private App can be installed only on its owning account. For an organization repository, the manifest registration runs under that organization and GitHub applies its registration and installation rules. This wizard registers a new App for each setup.

## Work on issues and PRs

Create an issue as the installing owner. Its stated scope authorizes a plan, changes, checks, commits, pushes, and a PR. The clone opens the PR as a draft and marks it ready for review when its checks pass, it has no conflicts, and every review thread is handled. Scope expansion still needs your decision.

Write `@shadowclone` followed by a request on an issue or a same-repository PR. You can also use the App slug, such as `@my-shadowclone`. External users, fork PRs, and the clone's own comments cannot start work.

When the worker accepts a request, it reacts with `eyes` as the clone. The reaction goes on the tagged comment, or on the issue for a new issue. A review body or a CI-started run has no reaction. A failed reaction logs a warning and the work continues.

The clone follows the exported `shadowclone-work` skill and native engineering rules. It repairs checks, conflicts, and valid reviewer findings before it marks the PR ready. It reports a check that waits for a human and does not retrigger it. Each run has a 20-minute limit and 60 turns. Each branch has a daily limit of ten worker runs. A run can stop before the finish line; inspect its Actions result before requesting another attempt.

GitHub Actions completion and approved reviewer events can resume a managed PR. The default reviewer bot list contains `coderabbitai[bot]` and `github-actions[bot]`. Review findings from repository writers also qualify. To change requesters, reviewers, or limits, review both workflow configurations in a PR.

A fixed finding gets a reply with only its commit hash. The clone resolves fixed bot threads and leaves fixed human threads open. A declined finding gets no reply and stays open. You merge the PR. The clone never merges, releases, or force pushes.

## Continue locally

1. Add `shadowclone:paused` to the issue or PR.
2. Confirm the active Shadowclone workflow stops in GitHub Actions.
3. Run `gh pr checkout <number>` in your local checkout.
4. Make and push your changes.
5. Remove `shadowclone:paused` when the clone can continue.

A pause on the original issue also blocks its issue branch. The worker checks pause state again after queuing. Its prompt requires another check before writes. Cancellation and instruction checks do not make an in-flight GitHub write atomic.

## Guidance and credentials

The preview contains only selected skills, supporting resources, plugin metadata, and applicable native rules. Text uses Shadowclone's existing redaction path. Symlinks, private state directories, identifying paths that remain after redaction, and encoded bundles above 48 KB prevent export.

The App private key, Claude subscription token, and guidance are secrets in the `shadowclone` environment. Only the repository's default branch can deploy to it. Setup preserves an existing environment's approval settings and rejects broader branch policies. GitHub plan support for environments and environment secrets must cover the target repository.

The environment still trusts its default-branch workflows and code executed with credentials. An App installation token reaches the coding agent for Git and GitHub actions. The agent can run any shell command on the runner with that token. The private App key does not. The owner can change App permissions on GitHub, so inspect the installation when its access changes.

Before it uploads any secret, setup adds the `shadowclone default branch` ruleset. Only people with the admin, maintain, or write role can update or delete the default branch, so the App cannot push to it or merge into it. People keep their access. Workflows that push to the default branch with `GITHUB_TOKEN` stop working, because GitHub Actions is not on the bypass list. Setup stops if a ruleset with that name has other settings. Rulesets need the same plan support as environments.

Setup keeps App registration credentials in memory until the local server closes. It never reads an existing Claude credential store. The token travels through the loopback password request and GitHub CLI stdin. The exported bundle is frozen; later local guidance edits do not automatically upload.

`shadowclone bot export --skill shadowclone-work --skill shadowclone-baseline --output <private-file>` writes a bounded bundle outside the checkout. It makes no upload. `shadowclone bot status` shows saved installation metadata and its setup PR link. GitHub Actions and the PR show live work status.

## Stop and remove

Pause current work, cancel any remaining Actions run, and remove the two Shadowclone workflows and `.github/shadowclone/` through a reviewed PR. Delete the three secrets from the `shadowclone` environment and the `shadowclone default branch` ruleset. Uninstall or delete the App on GitHub. Remove local metadata under `~/.shadowclone/cloud/installations/` if it is no longer needed.

Closing the setup server removes its in-memory preview and registration credentials. Export files remain until you delete them. GitHub and the selected provider apply their own retention policies to cloud runs and repository content.
