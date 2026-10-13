---
name: setup-cloud-sessions
description: Configure shadowclone cloud sessions on a spare machine. A /shadowclone comment on GitHub then makes Claude Code or Codex work as the user in Docker. Use it when the user asks for cloud sessions, a spare machine, or a home server for their GitHub repositories.
license: MIT
---

# Set Up Cloud Sessions

Do the whole setup for the user. The user answers questions in chat, pastes tokens into a file, and approves two changes. Run the steps in order. Do not explain a step that works.

A cloud session runs on this machine in Docker. It acts as the user, on the user's own subscription or key. Only the user's own `/shadowclone <task>` comment starts it.

## Rules

- Never ask for a token in chat, and never read the secrets file. The user pastes each token into the file in an editor.
- Show the skill files and the ruleset summary to the user. Call the next step with `approve: true` only after the user agrees.
- If a step fails, show the exact error, fix what you can, and run the step again.

## 1. Check the machine (1 minute)

1. Run `shadowclone --version`. If the command is missing, install the CLI with `npm install -g @shadowclone/cli@latest`. Never use `sudo`.
2. Run `docker info`. If Docker does not run, ask the user to install and start Docker Desktop, OrbStack, or Docker Engine. Wait until `docker info` works.
3. Run `gh auth status`. If it reports no login, ask the user to run `gh auth login` in a terminal.

## 2. Ask three questions (30 seconds)

Ask these in one message. Use your question tool if you have one.

1. **Which repository?** Use `owner/repository`. Setup needs administration access to it.
2. **Which login?** The choices are:
   - `claude-subscription`: a Claude Pro or Max plan. The token comes from `claude setup-token`. This is the default.
   - `chatgpt-subscription`: a ChatGPT plan. Codex signs in with a device code. Setup refuses it on a public repository.
   - `anthropic` or `openai`: an API key.
   - `openai-compatible`, `ollama`, or `foundry`: an endpoint, which also needs a base URL and a model.
3. **Keep the agent trailer?** Each commit gets `Co-authored-by` for the agent unless the user says no.

## 3. Push the skills (main machine only)

Cloud sessions read the user's skills from the private repository `<owner>/shadowclone-skills`.

1. If this machine has the user's shadowclone skills, call the `shadowclone_session` tool with `operation: "skills"` in the repository checkout.
2. Show the file list. After the user agrees, call it again with `approve: true`.
3. Setup in step 4 can report that the skills repository is missing. On the spare machine, ask the user to ask their main agent to "push my shadowclone skills for cloud sessions". Then continue.

## 4. Run setup

1. Call `shadowclone_session` with `operation: "setup"`, the repository, the provider, and `baseUrl` and `model` when the provider needs them.
2. The first call returns the ruleset summary. The ruleset makes each change to the default branch go through a pull request, with no bypass. Show it to the user. After the user agrees, call setup again with `approve: true`.
3. Setup writes the config, creates the secrets file, pulls the clone image, and installs the `shadowclone serve` service.

If the tool is not available, run `shadowclone session setup --repo <owner/repository> --provider <provider>` in a terminal instead.

## 5. The user adds the tokens

1. Give the user the path of the secrets file and the list of names from setup.
2. For `GH_TOKEN`, give the user the token link from setup. The token must cover the repository and `<owner>/shadowclone-skills`.
3. For `claude-subscription`, ask the user to run `claude setup-token` in a terminal and paste the printed token.
4. For `chatgpt-subscription`, ask the user to run `shadowclone session login --repo <owner/repository>` in a terminal and enter the code.
5. Wait until the user says done.

## 6. Check and report

1. Call `shadowclone_session` with `operation: "status"` and the repository. It runs one check in Docker.
2. If a line says `fail`, give the user its detail, and check again after the user fixes it.
3. When every line says `pass`, tell the user to comment `/shadowclone <task>` on an issue or a pull request, and `/shadowclone review` on a pull request.
4. Tell the user that `shadowclone session list --repo <owner/repository>` shows the sessions, and that `shadowclone session logs` shows the last log on this machine.
