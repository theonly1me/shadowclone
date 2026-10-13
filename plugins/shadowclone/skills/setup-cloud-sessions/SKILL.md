---
name: setup-cloud-sessions
description: Configure shadowclone cloud sessions. A /shadowclone comment on GitHub then makes Claude Code or Codex work as the user. Sessions run in the user's Cloudflare, Vercel, Modal, Daytona, or E2B account, or on a spare machine. Use it when the user asks for cloud sessions or a background agent for GitHub.
license: MIT
---

# Set Up Cloud Sessions

Do the whole setup for the user. The user answers questions in chat, signs in to a host, pastes tokens in a terminal, and approves two changes. Run the steps in order. Do not explain a step that works.

A cloud session runs Claude Code or Codex as the user, on the user's own subscription or key, in an account that the user owns. Only the user's own `/shadowclone <task>` comment starts it.

## Rules

- Never ask for a token in chat, and never read a secrets file. The user pastes each token into a terminal prompt, a host page, or the secrets file.
- Show the skill files and the ruleset summary to the user. Call the next step with `approve: true` only after the user agrees.
- If a step fails, show the exact error, fix what you can, and run the step again.

## 1. Check the machine (1 minute)

1. Run `shadowclone --version`. If the command is missing, install the CLI with `npm install -g @shadowclone/cli@latest`. Never use `sudo`.
2. Run `gh auth status`. If it reports no login, ask the user to run `gh auth login` in a terminal.

## 2. Ask three questions (30 seconds)

Ask these in one message. Use your question tool if you have one. Put the recommended choice first.

1. **Where should sessions run?**
   - `cloudflare` (recommended): a Worker and a Container in the user's Cloudflare account. It needs the Workers Paid plan, and Docker on this machine for the deploy.
   - `local`: Docker on a spare machine that stays on. Run setup on that machine.
   - `vercel`: a Function and Vercel Sandbox. A 3-hour session needs Vercel Pro.
   - `modal`: a Modal endpoint and Modal Sandboxes. It needs the Modal CLI.
   - `daytona` or `e2b`: sandboxes in that account, with a receiver in Cloudflare, Vercel, Supabase, or Deno Deploy. E2B needs Pro for a 3-hour session.
2. **Which repository and which login?** The login choices are `claude-subscription` (default, from `claude setup-token`), `chatgpt-subscription` (only on `local`, and never on a public repository), `anthropic`, `openai`, `openai-compatible`, `ollama`, or `foundry`.
3. **Keep the agent trailer?** Each commit gets `Co-authored-by` for the agent unless the user says no.

## 3. Run setup

1. Call the `shadowclone_session` tool with `operation: "setup"`, the repository, `host`, `provider`, and `receiver`, `baseUrl`, or `model` when they apply.
2. If the skills repository is missing, call `operation: "skills"` in the repository checkout. Show the files, and call it again with `approve: true` after the user agrees. Then call setup again.
3. Setup returns the ruleset summary. The ruleset makes each change to the default branch go through a pull request, with no bypass. Show it to the user. After the user agrees, call setup again with `approve: true`.
4. If setup asks for a host sign-in, such as `wrangler login`, ask the user to run that command in a terminal. Then call setup again.

If the tool is not available, run `shadowclone session setup --repo <owner/repository> --host <host>` in a terminal instead.

## 4. The user adds the tokens

1. Give the user the list of secrets from setup, the `GH_TOKEN` link, and the place for each secret.
2. For `cloudflare` and `vercel`, ask the user to run `shadowclone session secrets --repo <owner/repository>` in a terminal. It asks for each value and stores it in the host.
3. For other hosts, give the user the host page that setup names.
4. For `claude-subscription`, the user gets the token from `claude setup-token`.
5. Wait until the user says done.

## 5. Check and report

1. Call `shadowclone_session` with `operation: "status"` and the repository.
2. If a line says `fail`, give the user its detail, and check again after the user fixes it.
3. When every line says `pass`, tell the user to comment `/shadowclone <task>` on an issue, or `/shadowclone review` on a pull request.
4. Tell the user that each session keeps a status comment on the issue, and that `shadowclone session list --repo <owner/repository>` lists the sessions.
