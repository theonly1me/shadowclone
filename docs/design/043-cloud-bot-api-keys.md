# Cloud bot on provider API keys

## Problem

The cloud bot had two identities, a GitHub App and a machine account, and three ways to sign in to a model. Each combination needed its own workflow steps, setup path, and tests. The browser setup wizard repeated what the CLI did.

The bot also worked for one owner. Other people with write access could not ask it for work or for a review. It also reviewed each pull request that the owner opened, even when nobody asked.

## Decision

The bot works like a hosted review bot. It is one GitHub machine account that runs on one provider API key. Anyone with write access to a repository that the bot belongs to can tag it.

**One identity.** The bot is a machine account that the owner creates and names, such as `octo-shadow`. Every job that writes uses its classic token, `SHADOWCLONE_BOT_TOKEN`, with only the `repo` scope. Commits use `<id>+<login>@users.noreply.github.com`, so they count on the bot's profile.

**Four providers, keys only.** The owner chooses one provider at setup. Each provider has one secret, and the workflows read only that secret:

| Provider            | Secret                      | Agent            |
| ------------------- | --------------------------- | ---------------- |
| `anthropic`         | `ANTHROPIC_API_KEY`         | Claude Code      |
| `openai`            | `OPENAI_API_KEY`            | Codex            |
| `openai-compatible` | `OPENAI_COMPATIBLE_API_KEY` | Codex            |
| `cursor`            | `CURSOR_API_KEY`            | Cursor Agent CLI |

- Claude Code runs through `anthropics/claude-code-action` with `anthropic_api_key`.
- Codex 0.159.0 signs in with `codex login --with-api-key`. For an OpenAI-compatible provider, it also gets `-c openai_base_url="<url>"` and `--model <id>`. That endpoint must serve the OpenAI Responses API, because Codex sends only Responses requests.
- The Cursor CLI comes from a pinned archive with a SHA-256 check. Work runs with `--print --force --trust`. A review gets its own `CURSOR_CONFIG_DIR` that allows reads and denies commands, writes, and MCP tools.

Workflows never read a subscription login. A Bedrock, Vertex, or Foundry login with GitHub OIDC is a later change.

**Tags start everything.** The guard checks the event's repository ID, then the live collaborator permission of the person who acted. Only `admin`, `maintain`, and `write` pass.

- An issue starts work only when its title or body tags `@<bot>`.
- A comment starts work only when it tags `@<bot>`.
- A comment whose first line is `@<bot> review` starts a review of that pull request, also when the pull request comes from a fork.
- A pull request that opens starts nothing.

The bot and other bots cannot start work. Work on a fork pull request is refused, because the bot cannot push to a fork. Review feedback on a pull request that the bot owns still resumes work, as before.

**Fork reviews run no fork code.** The relay starts the worker from the default branch, so the review jobs have the secrets, and the guard is the only gate. For a fork head, the review skips the job that runs the pull request's toolchain. It also turns the network off for the prepare and analyze steps. So code from the fork never runs, and the model has no network path to send data out.

**Setup in one command.** `shadowclone bot setup --bot <login> [--provider <name>]` and the MCP tool `shadowclone_bot` do these steps:

1. Check the provider settings. A wrong base URL or a missing model stops setup before it writes anything.
2. List the skill files, and wait for approval.
3. Protect the default branch. The ruleset exempts only the admin and maintain roles, so the bot cannot update the default branch. If a ruleset with the same name differs, setup stops and names it.
4. Push the skills to the private `<owner>/shadowclone-skills` repository and add a read-only deploy key.
5. Create the `shadowclone` environment, limited to the default branch.
6. Invite the bot, and open the setup pull request.

Setup returns one environment link for the bot token and the API key, and the setup pull request link. It also names the page that creates each secret. Shadowclone never reads either secret.

**A check run proves the setup.** The setup pull request adds `shadowclone-check.yml`, which starts only by dispatch. `shadowclone bot status --repo <owner/repository>` starts it after the secrets exist and the pull request merges. The run accepts the invitation as the bot, reads the repository with the bot token, and makes one request that the API key must authorize:

- Anthropic, OpenAI, and compatible providers list their models.
- Cursor answers one short prompt.

The command prints the run link, or the step that failed. The CLI waits up to 8 minutes. The MCP tool waits up to 45 seconds, and a later status call continues a run that is still in progress.

**Removed.** The GitHub App identity, the browser bot wizard, `CLAUDE_CODE_OAUTH_TOKEN`, the ChatGPT plan login, the `requesters` list, and automatic reviews are gone. A saved setup from an earlier version does not parse, so `status` asks for setup again.

## Consequences

- Anyone with write access can spend the API key. The limits of 10 runs for each branch each day and 100 runs each day stay. The guide points to the spending limit in the provider console.
- The owner pays for API use. A subscription does not cover the bot.
- A repository with an App setup needs the new setup pull request. The App and its secrets stay until the owner deletes them.
- The OpenAI-compatible provider supports only endpoints that serve the Responses API.

## Verification

- Workflow tests render each provider and check that its files read only its own secret, plus the bot token and the skills key.
- Guard tests: `write`, `maintain`, and `admin` can tag, and `triage`, `read`, and `none` cannot. An untagged issue starts nothing. The bot answers only to its own login. A fork pull request gets a review and no work.
- Workflow tests: a fork head skips the toolchain job and reviews with the network off.
- Setup tests: settings fail before any write, and the outcome has the environment link.
- Check tests: a run that started earlier does not count, a running check continues, and a failed run names its step.
- Engine tests: a Cursor review gets the deny list and no GitHub token, and Codex gets the base URL.
