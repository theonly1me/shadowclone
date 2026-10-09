---
name: setup-shadowclone
description: Install and configure Shadowclone. Use it when the user asks to "set up", configure, initialize, or start Shadowclone with Claude Code, Codex, Cursor, Pi, Antigravity, or another coding agent.
license: MIT
---

# Set Up Shadowclone

Finish the local setup. Let the user make each data choice.

## Detect

1. Run `node <this-skill-directory>/scripts/check-cli.mjs` from the real directory of this skill. The helper runs only `shadowclone --version`. It reads no configuration and no user data. It needs a stable CLI version 0.0.13 or newer.
2. If the status is `outdated`, show the installed version and the minimum version, and ask the user if you may upgrade the CLI. If the status is `unavailable`, explain that no usable CLI exists, and ask the user if you may install it. Stop if the user says no.
3. After the user approves, run `npm install -g @shadowclone/cli@latest`. Never use `sudo`. If npm cannot write to its global directory, explain the exact failure. Help the user choose a user-owned npm prefix, then try again.
4. Run the helper again after the install or upgrade. Continue only when the status is `ready`. If the status is still `outdated`, the release that you need may not exist yet. The installed package may be new enough while the helper still sees an older command. Then run `command -v shadowclone` and `npm prefix -g` to find a stale executable or a missing prefix on `PATH`. Help the user fix it. Do not delete unrelated installations.
5. Run `shadowclone init --status --json`. Only `{"initialized":true}` means that setup exists. Keep a compatible existing installation and its consent settings.

This skill runs without MCP. MCP can stay disconnected until you install the CLI. That does not block these shell commands or the consent questions.

## Ask for consent

If setup does not exist yet, ask these three questions one at a time. Record an explicit yes or no for each one.

1. May Shadowclone learn working preferences from detected coding-agent sessions?
2. May Shadowclone keep portable skills in sync and maintain them across detected agents?
3. May Shadowclone continue consented learning in the background?

Explain that background learning needs session learning. If the first answer is no, the third answer must be no. Do not infer an answer from the plugin install, from the use of an agent, or from another answer.

Run one non-interactive initialization command. Pass exactly one flag from each pair:

- `--learn` or `--no-learn`
- `--skill-maintenance` or `--no-skill-maintenance`
- `--background-learning` or `--no-background-learning`

The initialization detects the installed Claude Code, Codex, Cursor, Pi, and Antigravity environments. It installs native guidance for those agents. Keep an existing configuration. Do not replace its consent choices.

## Build

1. Start `shadowclone wizard --no-open` as a bounded background process. Capture the loopback URL that it prints.
2. Give the URL to the user. Keep the process running while the user chooses skills, reads instructions, and applies the build.
3. Do not operate the browser for the user. Wait until the user says that they applied the build.

## Verify

After the user applies the build, follow these steps:

1. Run `shadowclone sync`.
2. Run `shadowclone doctor`. Fix each local failure that you can act on.
3. Run `shadowclone context --explain` in the current repository. Summarize which guidance is active. Do not copy private content.
4. Tell the user to restart each open coding-agent session. This loads the native integration and the MCP server again.

Do not turn on a source, call a model, read sessions, or publish files without the matching consent. Keep command output that holds local paths or user content out of shared artifacts.
