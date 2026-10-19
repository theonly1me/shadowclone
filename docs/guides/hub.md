# Hub

The hub lets you check, start, steer, and answer your clones from the Claude app on your phone, or from any MCP client. It is an MCP server on a machine that stays on, behind Tailscale Funnel. It needs no domain and no shadowclone account.

```text
$ shadowclone hub expose
Public URL: https://studio.tail1234.ts.net
Connector URL: https://studio.tail1234.ts.net/mcp
$ shadowclone hub pair
Pairing code: K7QM-2WXA
```

On your phone, ask Claude "what are my clones doing?" Claude lists them, with the ones that need you first. It can also send a clone your answer.

## Before you start

1. Set up clones on the machine, as the [clones guide](clones.md) describes. The hub reaches the clones of this machine.
2. Install [Tailscale](https://tailscale.com/download) and sign in. Funnel must be on for your tailnet. If it is off, `hub expose` prints the link that turns it on.

## Set up the hub (about 5 minutes)

1. Run `shadowclone hub service`. The hub then starts with the machine. To try it first, run `shadowclone hub serve` in a terminal.
2. Run `shadowclone hub expose`. It turns on Tailscale Funnel for the hub and prints the connector URL.
3. Run `shadowclone hub pair`, and keep the code. The code works once, for 10 minutes.
4. In Claude, open **Settings**, then **Connectors**, and add a custom connector with the connector URL.
5. Claude opens the hub's sign-in page. Check that the page names `claude.ai`, type the code, and select **Approve**.

The connector then works in Claude on the web, Desktop, and mobile. Claude Code on another machine can add the same URL with `claude mcp add --transport http shadowclone-hub <connector URL>`.

If you run your own proxy on the hub machine, run `shadowclone hub expose --url https://<your proxy>` instead of step 2. The proxy must send requests to `http://127.0.0.1:4517` and set `X-Forwarded-For`.

## Add another machine

Each other machine with clones joins the hub. It opens one connection to the hub and needs no open port.

1. Set up clones on the other machine.
2. On the hub machine, run `shadowclone hub pair --node`.
3. On the other machine, run the `shadowclone hub join` command that the hub printed. It saves the link and starts the node link as a service.
4. On the hub machine, run `shadowclone hub nodes`, and check the name and the time that the hub last saw it.

Claude now lists the clones of each machine. To start a clone on a machine, name it: "start a clone on work to fix the parser". On a joined machine, Claude Code and Codex see every machine through `shadowclone mcp`, with no sign-in.

If you do not want the Claude app to reach the hub, run `shadowclone hub expose --tailnet` instead of `hub expose`. Then only machines on your tailnet reach the hub.

## What a client can do

A connected client has the two clone tools: `shadowclone_sessions` reads, and `shadowclone_clone` starts, steers, answers, and stops. Claude asks you before it calls `shadowclone_clone`. Text that comes from a clone is data. The hub tells the client so, and the client must not follow instructions in it.

## Keep it safe

The hub can start agents that act as you on GitHub. Treat a pairing code like a password.

- `shadowclone hub clients` lists the approved clients. `hub clients revoke <id>` stops a client at once.
- `shadowclone hub lock` refuses every request, for example when you lose your phone. `hub unlock` allows them again.
- `shadowclone hub allow anthropic tailnet` accepts requests only from Claude's servers and your tailnet. Keep `tailnet` when other machines joined. `hub allow --any` removes the limit.
- `shadowclone hub nodes remove <name>` stops a machine. It must join again with a new code. On that machine, `shadowclone hub leave` removes the link.
- `shadowclone hub status` shows the URL, the lock, the allowed sources, and the number of clients.

A wrong code counts against every open code, and a code locks after 5 wrong tries. Access tokens last 1 hour, and a refresh token works once.

## Stop and remove

1. Run `shadowclone hub expose --off` to turn off Funnel for the hub.
2. Remove the service. On macOS, run `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/dev.shadowclone.hub.plist` and delete the file. On Linux, run `systemctl --user disable --now shadowclone-hub.service`.
3. Delete `~/.shadowclone/hub/`. Every client must then sign in again.
4. Remove the connector in Claude.
