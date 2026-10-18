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

Cloud sandbox hosts come back later as workers that the hub starts. Other tunnels and a shared relay wait until users ask for them.

## Step 1: clones on a node

**Start.** `shadowclone clone start --repo owner/repository [--issue N | --pull N | --review N] [task]` and the MCP tool `shadowclone_clone` with `start` write a request to `~/.shadowclone/clones/runs/<id>/request.json`. The request holds the repository, the kind (`work` or `review`), the task, and the issue or pull request.

**Branch.** A task with no issue or pull request works on `shadowclone/<id>`. An issue works on `shadowclone/issue-<number>`. A pull request continues on its own head branch. A clone cannot push to a fork, so a fork pull request accepts only a review.

**Run.** `shadowclone serve` is the only process that starts clones. It takes a lock, so a second `serve` on the same machine stops. Every 2 seconds it reads the run folders, and it starts the oldest queued clone while fewer than 2 clones run. A ChatGPT plan login runs one clone at a time, because OpenAI asks for one serialized job stream for each `auth.json`.

Each clone runs in a fresh container from the clone image, as in 044. The run program prints progress lines on standard output. `serve` reads them and writes `record.json` and `events.jsonl` in the run folder. So `serve` is the only writer of the state, and the container needs no host folder.

**States.** `queued`, `working`, `waiting` (from step 2), `done`, `failed`, `limited`, and `stopped`. The run program decides the final state from the exit code, a usage limit, or a stop. If the container exits with no final progress line, the clone is `failed`.

**Stop.** `shadowclone clone stop <id>` and `stop` in the tool write a stop marker. `serve` stops the container with SIGTERM, and the run program commits and pushes the unfinished work, as in 044. A queued clone that has a stop marker never starts.

**Budget.** The node refuses a new clone when the repository already had `dailyClones` clones in the last 24 hours. The default is 20. It also refuses a clone for an issue or pull request that another queued or working clone uses.

**CI.** The poller is gone, so nothing starts a clone again after it exits. The prompt tells the clone to watch the CI of its pull request and fix each failure before it stops, within its 170-minute limit.

**Kept from 044.** The owner's fine-grained token, the pre-push hook, the commit trailer, and the default branch ruleset stay. So do the `shadowclone` label, the line in the pull request body, the save after SIGTERM, and the review stages.

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

## Consequences

- An owner can start a clone from any agent on the node without GitHub. A phone needs the hub from step 3.
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

## Data handling

The run folder holds the owner's task text, the progress lines, and the container log. The folder has mode 0700 and its files mode 0600. `serve` removes a finished run folder after 30 days. Nothing in the run folder leaves the machine in step 1. The container sends the repository, the skills, and the prompt to the chosen model provider, as in 044.
