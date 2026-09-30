---
name: setup-shadowclone
description: Install and set up Shadowclone when the user asks to set up, configure, initialize, or start using Shadowclone with Claude Code, Codex, Cursor, Antigravity, or another coding agent.
license: MIT
---
# Set Up Shadowclone

Complete the local setup while keeping each data choice with the user.

## Detect

1. Run `node <this-skill-directory>/scripts/check-cli.mjs` using this skill's actual directory. The helper checks only `shadowclone --version`, reads no configuration or user data, and requires stable CLI version 0.0.13 or newer.
2. If its status is `outdated`, show the installed and minimum versions and ask whether to upgrade the CLI. If it is `unavailable`, explain that a usable CLI is missing and ask whether to install it. Stop if the user declines.
3. After approval, run `npm install -g @shadowclone/cli@latest`. Never use `sudo`. If the package manager cannot write to its configured global directory, explain that exact failure and help the user choose a user-owned npm prefix before retrying.
4. Repeat the helper after installation or upgrade. Continue only when its status is `ready`. If it remains outdated, the required release may not be published yet. If the installed package is new enough but the helper still sees an older command, inspect `command -v shadowclone` and `npm prefix -g` for a stale executable or missing prefix on `PATH`; help the user resolve it without deleting unrelated installations.
5. Run `shadowclone init --status --json`. Treat only `{"initialized":true}` as an existing setup. Preserve compatible existing installations and their consent settings.

The setup skill runs independently of MCP. MCP may be disconnected until the CLI is installed; this does not prevent these shell commands or consent questions.

## Ask for consent

When setup is not initialized, ask these three questions separately and record an explicit yes or no for each:

1. May Shadowclone learn working preferences from detected coding-agent sessions?
2. May Shadowclone keep portable skills synchronized and maintain them across detected agents?
3. May Shadowclone continue consented learning in the background?

Explain that background learning requires session learning. If the first answer is no, the third must also be no. Do not infer an answer from installing the plugin, using an agent, or accepting another choice.

Run one non-interactive initialization command with exactly one flag from each pair:

- `--learn` or `--no-learn`
- `--skill-maintenance` or `--no-skill-maintenance`
- `--background-learning` or `--no-background-learning`

The initialization detects installed Claude Code, Codex, Cursor, and Antigravity environments and installs native guidance for those agents. Preserve an existing configuration instead of replacing its consent choices.

## Build

1. Start `shadowclone wizard --no-open` as a bounded background process and capture the loopback URL it prints.
2. Give the URL to the user and keep the process running while they choose skills, inspect instructions, and apply their build.
3. Do not operate the browser for the user. Wait for them to say they applied the build.

## Verify

After the build is applied:

1. Run `shadowclone sync`.
2. Run `shadowclone doctor` and address actionable local failures.
3. Run `shadowclone context --explain` in the current repository and summarize which guidance is active without copying private content.
4. Tell the user to restart each open coding-agent session so its native integration and MCP server reload.

Do not enable sources, call a model, read sessions, or publish files without the matching consent. Keep command output containing local paths or user content out of shared artifacts.
