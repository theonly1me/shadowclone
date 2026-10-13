# Cloud sessions on your own host

## Problem

[043](043-cloud-bot-api-keys.md) moved the GitHub bot to API keys, because anyone with write access can tag the bot. A subscription login belongs to one person, so other people must not spend it. Owners still want Claude Code or Codex to work on their GitHub issues from a machine that is not their laptop, on their own subscription. There is no shadowclone server, so the run must happen on a host that the owner owns.

## Decision

shadowclone gets a second mode next to the bot. A **cloud session** runs Claude Code or Codex for the owner, as the owner, on a host that the owner owns. Only the owner can start a session. There is no bot account. The bot from 043 does not change.

**Identity.** A session uses the owner's fine-grained GitHub token, limited to the repositories that the owner chooses and to `<owner>/shadowclone-skills`. Commits and pull requests show the owner. A `shadowclone` label, one line in the pull request body, and a `Co-authored-by` trailer for the agent show that an agent did the work. `attribution: false` in the session config turns off the trailer.

**Triggers.** A session starts or continues only in these cases:

1. A comment from the owner's numeric user ID whose first line is `/shadowclone <task>` or `/shadowclone review`.
2. `shadowclone session start`, which posts that comment through `gh`. So the main machine needs no connection to the host.
3. A finished CI run on a session branch, when the head is the commit that the session pushed last. A push by the owner by hand does not continue the session.
4. A review or a review comment from an allowed reviewer bot on a session pull request.

**GitHub holds the state.** The host keeps no database:

- A claim is a ref, `refs/shadowclone/claims/<date>/<branch hash>/<request hash>`. GitHub answers 201 for a new ref and 422 for one that exists, so two hosts cannot run one request twice. The refs of a day give the budget: 10 runs for each branch and 100 for each repository.
- `refs/shadowclone/sessions/<branch hash>` points at the last commit that the session pushed.
- One status comment on the issue or pull request holds the state and a machine-readable block. The run edits it in place. `shadowclone session list` reads it, and a later iOS app can read it.

**One run program.** `shadowclone session run` runs in the clone image on every host. It does these steps:

1. Read the trigger again from the GitHub API, and check the owner ID.
2. Claim the request, react with eyes, and write the status comment.
3. Clone the repository and the skills repository with the owner's token.
4. Add a pre-push hook that refuses the default branch, and a commit hook for the trailer.
5. Run the unmodified `claude -p` or `codex exec` with the session prompt. A review runs the stages of `shadowclone review`, skips the toolchain stage on a fork head, and turns the network off for a fork.
6. Label the pull request, add the body line, move the session ref, and update the status comment.
7. On a timeout or SIGTERM, commit the remaining changes and push them to the session branch.

**Logins.** The session config names one provider:

| Provider               | Engine      | Login                                                                                |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `claude-subscription`  | Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`                                  |
| `anthropic`            | Claude Code | `ANTHROPIC_API_KEY`                                                                  |
| `chatgpt-subscription` | Codex       | `auth.json` on a host volume, from `codex login --device-auth` on the host           |
| `openai`               | Codex       | `OPENAI_API_KEY`                                                                     |
| `openai-compatible`    | Codex       | `OPENAI_COMPATIBLE_API_KEY`, a base URL, and a model                                 |
| `ollama`               | Codex       | A base URL, a model, and an optional `OLLAMA_API_KEY`                                |
| `foundry`              | Codex       | `AZURE_OPENAI_API_KEY`, `https://<resource>.openai.azure.com/openai/v1`, and a model |

Anthropic allows a person to sign in to "the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code". It does not allow tools that "collect, store, or intermediate" Claude credentials. So the owner pastes each token into the host's own secret store, and shadowclone never reads it. OpenAI says not to use a ChatGPT plan login for automation on public repositories, and to use one `auth.json` copy from one serialized job stream. So setup refuses `chatgpt-subscription` on a public repository, and a host runs one session at a time for that login.

**Hosts.** The first host is a spare machine with Docker. `shadowclone serve` polls GitHub every 60 seconds and runs as a launchd or systemd service. It runs one session at a time. Each session runs in a fresh container from `ghcr.io/theonly1me/shadowclone-clone:<version>`. The container gets the tokens through `docker run --env-file ~/.shadowclone/clones/secrets.env`. The network is open, so web search and page fetches work.

Later parts add cloud hosts. A thin receiver checks the webhook signature and the sender ID, and starts a sandbox. It runs on Cloudflare Workers, Vercel, Supabase, or Deno Deploy. The sandboxes are Cloudflare Containers, Vercel Sandbox, Modal, Daytona, and E2B. Setup picks the pair that needs the fewest new accounts.

**Setup.** The `setup-cloud-sessions` skill in the `shadowclone` plugin drives setup on the host. It calls the `shadowclone_session` MCP tool, which shares one engine with `shadowclone session setup`. Setup does each step that the owner's logins allow. The owner pastes the tokens and approves the default branch rule.

**Default branch.** The owner can bypass the bot ruleset from 043, so the owner's token can update the default branch. Setup adds the `shadowclone sessions default branch` ruleset, which requires a pull request and has no bypass. The owner approves it first. The pre-push hook refuses the default branch too.

**Package.** `@shadowclone/clones` holds the config, triggers, run program, server, and setup. It depends on `core` and `cloud`, and reuses the skills repository code and the GitHub record helpers from `cloud`. `cli` and `mcp` depend on it. The run program starts `shadowclone review` as a process, so `clones` does not import `review`.

## Consequences

- A session acts as the owner. A prompt injection in an issue can try to use the owner's token. The token reaches only the chosen repositories, and the prompt treats issue text as task data.
- The ruleset with no bypass also blocks the owner's direct pushes. In an organization, it applies to every member.
- A subscription has a 5-hour limit and a weekly limit. A session that reaches one saves its work and writes the reset time in the status comment.
- A spare machine works only while it is on. GitHub keeps no queue for a poller. When the host starts again, it reads the comments of the last day.
- Cursor and the `sandbox-runtime` worktree mode are not part of sessions yet.

## Verification

- Schema tests reject a subscription in the bot, `chatgpt-subscription` on a public repository, and each provider without its settings.
- Trigger tests: the owner starts a session. A collaborator, a bot, and an edited comment from someone else start nothing. CI continues a session only on the commit that the session pushed last.
- State tests: a second claim of one request gets 422 and stops. The eleventh run of a branch in one day stops.
- Run tests use a fake GitHub and a fake engine. They check the hooks, the trailer switch, the label, the session ref, and the save after SIGTERM.
- A live check on a private repository: `/shadowclone` from the owner opens a draft pull request with the owner's commits. The same comment from a second account starts nothing. A push to the default branch fails.

## Data handling

Tokens stay in the host's secret store. The session container sends the repository, the skills, and the prompt to the chosen model provider, as the bot does. The status comment holds the state and step names, never transcript text. Setup writes `~/.shadowclone/clones/` on the host: the session config, the secrets file (mode 0600, which the owner fills), and the poll cursors.
