# Clones

## Problem

In [044](044-cloud-sessions.md), a cloud session starts only from the owner's `/shadowclone` comment, and GitHub holds its state. The owner must open GitHub to start, check, or stop a session. Nothing can send a session more instructions or answer its question while it works.

The name is also wrong. A session can run on the owner's laptop, on a second machine, or in a cloud account. "Cloud" describes only one of these places.

## Decision

A **clone** is a session that shadowclone starts and runs as the owner, on a machine that the owner owns. The owner starts and controls clones through the CLI and the MCP server. GitHub stays the place where a clone clones, pushes, and opens pull requests as the owner. GitHub is no longer the control channel.

**Terms.** A clone is a session that shadowclone runs. A live session is a Claude Code or Codex session that the owner starts. A node is a machine that runs clones. A hub is the MCP server that lists and steers the sessions of every node.

**Sequence.** Each step is one pull request:

1. Clones start from the CLI and the MCP server of the node. The comment trigger, the GitHub state, and the five cloud sandbox hosts go.
2. A running clone takes more messages, and asks the owner questions with a deadline.
3. A hub serves MCP over Streamable HTTP with OAuth, behind Tailscale Funnel. The Claude app on a phone can then reach it.
4. Other machines join the hub over the tailnet.
5. The hub lists live Claude Code and Codex sessions, behind a consent flag that is off by default.
6. The hub sends an optional push notification when a clone needs the owner.
7. The owner pairs two live sessions, so that each can send the other notes.

Cloud sandbox hosts come back later as workers that the hub starts. Other tunnels and a shared relay wait until users ask for them.

## Step 1: clones on a node

**Start.** `shadowclone clone start --repo owner/repository [--issue N | --pull N | --review N] [task]` and the MCP tool `shadowclone_clone` with `start` write a request to `~/.shadowclone/clones/runs/<id>/request.json`. The request holds the repository, the kind (`work` or `review`), the task, and the issue or pull request.

**Branch.** A task with no issue or pull request works on `shadowclone/<id>`. An issue works on `shadowclone/issue-<number>`. A pull request continues on its own head branch. A clone cannot push to a fork, so a fork pull request accepts only a review.

**Run.** `shadowclone serve` is the only process that starts clones. It takes a lock, so a second `serve` on the same machine stops. Every 2 seconds it reads the run folders, and it starts the oldest queued clone while fewer than 2 clones run. A ChatGPT plan login runs one clone at a time, because OpenAI asks for one serialized job stream for each `auth.json`.

Each clone runs in a fresh container from the clone image, as in 044. The run program prints progress lines on standard output. `serve` reads them and writes `record.json` and `events.jsonl` in the run folder. So `serve` is the only writer of the state, and the container needs no host folder.

**States.** `queued`, `working`, `waiting` (from step 2), `done`, `failed`, `limited`, and `stopped`. The run program decides the final state from the exit code, a usage limit, or a stop. If the container exits with no final progress line, the clone is `failed`. When `serve` starts, it marks each `working` or `waiting` clone from an earlier run as `stopped`, because its container is gone.

**Stop.** `shadowclone clone stop <id>` and `stop` in the tool write a stop marker. `serve` stops the container with SIGTERM, and the run program commits and pushes the unfinished work, as in 044. A queued clone that has a stop marker never starts.

**Budget.** The node refuses a new clone when the repository already had `dailyClones` clones in the last 24 hours. The default is 20. It also refuses a clone for an issue or pull request that another queued or working clone uses. A start holds `start.lock` while it checks these limits and writes the request, so two starts at the same time cannot both pass.

**CI.** The poller is gone, so nothing starts a clone again after it exits. The prompt tells the clone to watch the CI of its pull request and fix each failure before it stops, within its 170-minute limit.

**Kept from 044.** The owner's fine-grained token, the pre-push hook, and the commit trailer stay. So do the `shadowclone` label, the line in the pull request body, the save after SIGTERM, and the review stages.

**Repository settings.** Setup changes none of the repository settings. The 044 setup added a default branch ruleset with no bypass. So the owner could not push to the default branch either, and in an organization the rule bound every member. The pre-push hook in the container keeps a clone off the default branch. An owner who wants GitHub to enforce that adds a ruleset. Setup needs write access, and it refuses a repository that the owner cannot push to.

**Removed.** The `/shadowclone` command, the reviewer bot trigger, claim refs, session refs, status comments, and the `shadowclone:paused` label go. So do the poller, the receivers, and the Cloudflare, Vercel, Modal, Daytona, and E2B hosts. The config format changes to version 2. A saved config from 044 does not parse, and the message tells the owner to run setup again.

**Commands and tools.** `shadowclone session` becomes `shadowclone clone`. The setup tool `shadowclone_session` becomes `shadowclone_clone_setup`, for this machine only. Two new tools split reads from writes, so a client can allow reads without a question. `shadowclone_sessions` has `list` and `get`, and carries `readOnlyHint`. `shadowclone_clone` has `start` and `stop`.

**Module.** `@shadowclone/clones` exports `localNode`. Its `start`, `list`, `get`, and `stop` operations own the run folders, the budget, and the state rules. The CLI and the MCP server call only these operations. A later remote node gives the hub the same operations.

## Step 2: steer a clone and answer its questions

**Messages.** `shadowclone clone send <id> <message>` and `send` in `shadowclone_clone` add a line to `inbox.jsonl` in the run folder. `serve` writes each new line to the standard input of the container once, and records an event.

**Claude Code.** The run program starts `claude -p` with `--input-format stream-json` and `--output-format stream-json`. A message sent during a turn arrives inside a tool result. In a test run, Claude Code 2.1.302 ignored it as a possible prompt injection. So the run program sends an `interrupt` control request, waits for the turn to end, and sends the message as a new user turn. The interrupted tool call runs again.

**Codex.** The run program starts `codex app-server`. A message during a turn goes through `turn/steer` with the turn id, and a message after a turn starts a new turn. Codex 0.159.0 and 0.163.0 have the same shapes for these methods.

**Questions.** The run program gives the agent one MCP tool, `shadowclone_ask`, with a question, options, and a recommended option. The tool returns at once. The agent keeps working on the parts that do not depend on the answer. It does not take a destructive or outward step that the question covers.

**Answers and the deadline.** `clone answer <id> <question> <answer>` and `answer` in the tool accept only an open question. If a turn ends with an open question, the clone waits in the `waiting` state for up to 30 minutes. With no answer, the question expires. The clone then takes its recommended options, skips each destructive step, and lists it.

**Report.** The final progress line carries the agent's last message, through `redactSecrets`, at most 4000 characters. `clones` now depends on `redact` for this.

## Step 3: the hub

**Server.** `shadowclone hub serve` runs the new package `@shadowclone/hub`. It listens on `127.0.0.1` only, on port 4517 by default. It serves MCP over Streamable HTTP at `/mcp` with protocol versions `2025-03-26`, `2025-06-18`, and `2025-11-25`. It answers each request with one JSON object and offers no GET stream. The tools are `shadowclone_sessions` and `shadowclone_clone` from the MCP package, against `localNode`. A lock keeps one hub on each machine. `hub service` runs the hub under launchd or systemd.

**Reach.** `shadowclone hub expose` runs `tailscale funnel --bg --https=443` to the local port. It reads the machine name from `tailscale status --json` and saves `https://<name>.ts.net` as the public URL. The OAuth metadata uses that URL. `hub expose --url https://...` saves the URL of a proxy that the owner runs on the same machine. `hub expose --off` turns Funnel off.

**Sign-in.** The hub is its own OAuth authorization server. A client finds it through a `401` with `resource_metadata`, the protected resource metadata, and the authorization server metadata. Clients register through DCR as public clients. A redirect must use https, or http on `localhost` or `127.0.0.1`, where the port can change. Every authorization needs PKCE with S256.

**Pairing.** The consent page shows the client name and the host of its redirect. The owner types a code from `shadowclone hub pair`. A code works once, for 10 minutes. Each wrong code counts against every open code, and a code locks after 5 wrong tries. If a client has only loopback redirects, the page warns that any program on that computer can claim the name.

**Tokens.** An access token lasts 1 hour, and a refresh token lasts 30 days. Each refresh rotates the refresh token. A second use of an authorization code or of an old refresh token revokes the whole grant. The hub stores only SHA-256 hashes of codes and tokens, in `~/.shadowclone/hub/hub.db`.

**Controls.** `hub clients` lists the approved clients, and `hub clients revoke <id>` ends their tokens at once. `hub lock` refuses every request until `hub unlock`. `hub allow` limits the source addresses to `anthropic` (`160.79.104.0/21`), `tailnet`, `loopback`, or address ranges. Behind Funnel, every request comes from loopback. So the hub reads `X-Forwarded-For` only when the peer is loopback, and it uses the last address. Tailscale replaces that header with the real client address.

**Not now.** The hub does not accept a Client ID Metadata Document. Claude uses DCR when the metadata does not advertise CIMD. CIMD would also make the public hub fetch URLs that a caller names. The hub has no rate limit other than the pairing tries.

## Step 4: more machines

**Join.** `shadowclone hub pair --node` on the hub prints a node code. `shadowclone hub join <hub URL> --code <code>` on another machine sends the code and a name to `/nodes/pair`. The hub stores a hash of a new node token, and the machine saves the token in `~/.shadowclone/hub/link.json` (mode 0600). A node code cannot approve a client, and a client code cannot join a node. A node cannot take the name of the hub machine.

**Link.** `shadowclone hub link` runs as a service on the node. It opens a WebSocket to `/nodes/link` and reconnects with a backoff of 1 to 60 seconds. The token goes in the `Sec-WebSocket-Protocol` header, because the WebSocket client of Bun has no typed header option when the DOM types load. The hub answers with the `shadowclone-node` protocol. The node opens no port.

**Routing.** The hub tools take an optional `node`. `list` with no node shows each node in its own section, and an offline node with the time that the hub last saw it. `start` with no node runs on the hub machine. An operation on a clone id with no node goes to the node that has the clone. The hub sends a node the same tool call, and the node answers with its own `localNode`. A node that does not answer in 15 seconds gives an error.

**Local agents.** On a node, `shadowclone mcp` sends the two clone tools to the hub with the node token. So Claude Code and Codex on that machine see every node with no OAuth. If the hub does not answer, the tools answer for that machine and say so. A call that acts on another machine runs nothing then. This includes `start` with no node, which belongs to the hub machine.

**Reach.** A node reaches the hub at its `ts.net` URL inside the tailnet. `hub expose --tailnet` uses `tailscale serve` for a hub that only nodes reach. With `hub allow`, add `tailnet` so that nodes still reach the hub.

## Step 5: live sessions

**Consent.** `shadowclone live enable` turns on `remote.live-sessions` in `~/.shadowclone/config.toml`, and installs the live hooks. It is off by default. A managed policy turns it off unless the policy allows the `act` tier. `shadowclone live disable` removes the hooks and the saved state.

**Hooks.** Claude Code gets `SessionStart`, `UserPromptSubmit`, `Notification`, `PostToolUse`, `Stop`, `StopFailure`, and `SessionEnd` in `~/.claude/settings.json`. Claude Code sends `StopFailure` in place of `Stop` when an API error ends the turn, and ignores its output. Codex gets the same set in `~/.codex/hooks.json`, with `PermissionRequest` in place of `Notification` and no `StopFailure`. Codex now has hooks with `last_assistant_message` and a `Stop` decision, so it does not need `notify`. Codex asks the owner to trust new hooks. Removal finds each entry by the `live hook` text in its command.

**State.** Each session has one file, `~/.shadowclone/live/live-<hash>.json`, with mode 0600. It holds the engine, the repository from `origin`, the branch, the folder name, the state, the times, and the terminal. The summary is `last_assistant_message` through `redactSecrets`, at most 2 KB. The hooks store no prompt, no tool input or output, and no thinking. A permission prompt marks the session `needs-you` with the redacted notification text.

**Steering.** A message for a working session goes to `live-<hash>.inbox.jsonl`. `PostToolUse` adds it as context after the next tool call, and `Stop` continues the turn with it. Each message arrives once. `PostToolUse` starts shadowclone only when the file `~/.shadowclone/live/pending` exists, so a session with no message pays only a shell test. For an idle session, the node types the message into its tmux pane, or its cmux surface. If the terminal refuses, the message waits for the next turn. When a Claude turn ends with `StopFailure`, or Claude Code reports `idle_prompt`, the hook types each waiting message the same way.

**Terminals.** tmux takes keys from any process of the owner. By default, cmux accepts only processes that start inside cmux. So a hub or node service cannot type into a cmux surface unless the owner allows it. A session in tmux inside cmux records the tmux pane. shadowclone never types into a session that waits for a permission answer. Those answers stay with the terminal or Remote Control.

**Tools.** `shadowclone_sessions` lists live sessions after the clones, with `live-<hash>` ids, and `get` returns one. `shadowclone_clone` accepts only `send` for a live session.

## Step 6: pushes

**Topic.** `shadowclone hub notify` saves an ntfy topic URL in the hub database. With no `--url`, it makes a topic on `ntfy.sh` with 30 random hexadecimal characters. The topic name is the only secret, so the guide tells the owner to keep it private. `--off` removes it.

**Watch.** Every 15 seconds, the hub reads the states of its own clones and live sessions, and asks each connected node for its states. A push goes out when a clone or a live session starts to need the owner, and when a clone ends `done`, `failed`, or `limited`. Each event pushes once. The first scan after the hub starts pushes nothing. A node that joins later, or comes back, pushes nothing for states that it already had. If ntfy does not accept a push, the hub tries it again at each scan while its state lasts. It stops after 240 tries, about one hour. The log names the first failure and the last try.

**Text.** By default a push names the clone or live session, its state, and its machine. `hub notify --text` adds the repository and the question, through `redactSecrets`, at most 500 characters. `hub notify test` sends one push to check the topic.

## Step 7: paired sessions

**Pairing.** The owner pairs two live sessions of one machine with `shadowclone live pair <a> <b>`, or with `shadowclone_pair` through the hub. The server that sessions load has no pairing tool, so a session cannot pair itself. A session can be in one pair at a time. `~/.shadowclone/live/pairs.json` holds the pair id, the two session ids, a SHA-256 hash of the key of each side, the time, and the number of notes.

**Keys.** Each side gets its own random key in a pairing note. The note goes through the inbox, like an owner message. It names the peer, the key, and the limit. `shadowclone_peer` finds the sender from the hash of the key, so a session cannot send as its peer through the tool. A process of the owner can still read the live folder, so the key does not stop a local program.

**Notes.** A note reaches the peer in `<peer-message from="live-<hash>">`, after a line that says that the note is not from the owner. It arrives like an owner message: as context after the next tool call, at `Stop`, or typed into an idle tmux pane or cmux surface. A note has at most 8000 characters after `redactSecrets`. shadowclone replaces the wrapper tags in its text, so a note cannot end its own label.

**Limits.** A pair allows 20 notes in total, for both sessions together. A pair ends when either session ends, at `live unpair`, and at `live disable`. A session that resumes after its end has no pair.

## Consequences

- An owner can start a clone from any agent on the node without GitHub. A phone needs the hub from step 3.
- The hub is a public endpoint that starts agents that act as the owner. A flaw in sign-in would give a stranger the owner's GitHub. The pairing code, short tokens, revocation, the lock, and the allowlist limit this risk.
- With live sessions on, the last message of each live session leaves the machine through the hub. It can hold code or plans from that session.
- With pushes on, ntfy receives clone ids, states, and machine names. Anyone who knows the topic can read them.
- A message to an idle session becomes a prompt in that session, with the owner's permissions.
- A note from a paired session also becomes a prompt in its peer. Its label tells the agent to follow only the owner, but an agent can still act on it.
- Two paired sessions can use their 20 notes on a loop before the pair stops them.
- A node token gives the same clone tools as an approved client. `hub nodes remove <name>` revokes it.
- A local program can send a false `X-Forwarded-For` header. A local program already runs as the owner, so the allowlist guards only remote callers.
- A clone that exits before CI finishes does not continue. The owner starts it again on its pull request.
- A node that is off runs nothing. Queued clones wait in their folders until `serve` starts again.
- Existing cloud sandbox deployments and their repository webhooks stay until the owner deletes them. The guide lists the steps.
- The container controls its own progress lines, so an agent can report a wrong state for its own clone. It cannot change another clone.

## Verification

- Node tests: `start` writes a queued request and refuses an unknown repository. It also refuses the clone over the daily budget and a second clone for one issue.
- Driver tests: a Claude message interrupts and arrives as a new turn, and a Codex message steers the running turn.
- Supervisor tests: a turn with an open question waits, an answer continues it, and the deadline expires it.
- Serve tests: a message reaches the clone once, and an answer closes its question. A queued clone starts, its progress lines become its state, and a third clone waits while two run. A stop marker stops a working clone and keeps a queued clone from starting. A second `serve` stops at the lock.
- Run tests use a fake GitHub and a fake engine. They check the hooks, the trailer switch, the label, the body line, the save after SIGTERM, and the final state.
- Config tests: a version 1 config fails with the setup message.
- Hub tests send HTTP requests to the handler with a real database. They cover the `401`, a sign-in through to a tool call, plain PKCE, a wrong, used, or expired code, and the fifth wrong try. They also cover a code exchanged twice, refresh token reuse, revocation, expiry, the lock, the allowlist, the origin check, the protocol version, and loopback redirects.
- Push tests: a push has no question text or repository by default. The first scan pushes nothing, and a new question pushes once. A node that returns, or joins later, does not push its old states. With no topic, nothing is sent. A failed push goes out at the next scan, and a push that keeps failing stops after its last try.
- Live tests: with consent off, a hook writes nothing and `list` is empty. A stop keeps a redacted summary and no tool output. The `Stop` hook delivers a queued message once, and `PostToolUse` delivers one during a turn. An idle tmux pane gets the message, a refused terminal keeps it, and a working session queues it. `StopFailure` and `idle_prompt` type a waiting message. Install keeps the owner's own hooks.
- Pair tests: each side gets its own key, and a note reaches the peer with the sender's label. An idle tmux peer gets the note typed in. `peerSend` refuses a wrong key, the 21st note, and a key after its session ended. `peerNoteText` redacts and bounds a note, and the note cannot end its label. The server that sessions load lists `shadowclone_peer` and no pairing tool, and the hub lists `shadowclone_pair`.
- Node tests: a node code joins and opens the link, and a client code cannot. A link without a node token gets `401`. `list` merges two nodes and shows an offline node. `start` goes to the named node, and a clone id goes to its node. A real WebSocket test links a node and lists its clones through the forwarding tools. With no hub, the forwarding tools answer for the machine, and a `start` for another machine runs nothing.

## Data handling

The run folder holds the owner's task text, the progress lines, and the container log. The folder has mode 0700 and its files mode 0600. `serve` removes a finished run folder after 30 days. Nothing in the run folder leaves the machine in step 1. The container sends the repository, the skills, and the prompt to the chosen model provider, as in 044.

In step 3, the hub sends clone lists and clone details to each approved client. For the Claude app, that text passes through Anthropic. The hub database holds client names, redirect URIs, settings, and hashes of codes and tokens. The hub log names client ids and redirect hosts, never a token.

In step 4, a node sends the hub the text of its clone tool answers over the tailnet. `link.json` on the node holds the hub URL, the node name, and the node token. The hub database holds a hash of each node token.

In step 5, live sessions are a new consent flag, off by default. The hub sends each approved client the redacted last message of each live session. The live state stays in `~/.shadowclone/live/` until the session ends, and `live disable` deletes it.

In step 6, pushes are off until the owner runs `hub notify`. A push goes to the ntfy server of the topic. It holds no question text or repository unless the owner turns text on.

In step 7, a note stays in the inbox file of the peer until the peer gets it, and then shadowclone deletes it. `pairs.json` holds no note text and no key, only the key hashes and a count. A note stays on the machine. It leaves the machine only when the peer's agent sends it to its model provider.
