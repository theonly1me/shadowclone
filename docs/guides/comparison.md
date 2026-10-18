# Compare shadowclone with related tools

shadowclone is not a separate agent. It maintains one set of skills and instructions for Claude Code, Codex, Cursor, Pi, and Antigravity. The same skills reach a GitHub bot that runs Claude Code, Codex, or Cursor. So local and cloud agents write and review code with the same preferences.

Each section below uses only the project's own repository or documentation. The check date is 12 October 2026. "Not stated" means that those pages do not answer the question. It does not mean that the feature is missing.

## Summary

| Tool                    | What it is                                                                                   | Runs in the agent that you use | Agents                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------- |
| shadowclone             | Skills, instructions, learning, and a GitHub Actions bot for the agents that you already use | Yes                            | Claude Code, Codex, Cursor, Pi, Antigravity |
| pstack                  | A skill and principle pack                                                                   | Yes                            | Cursor                                      |
| Hermes Agent            | Its own agent with a learning loop                                                           | No, you run Hermes             | Hermes only                                 |
| Claude Code auto memory | Built-in notes from corrections                                                              | Yes                            | Claude Code                                 |
| Claude Subconscious     | A background Letta agent                                                                     | Yes                            | Claude Code                                 |
| imprint                 | A plugin that trains one profile                                                             | Yes                            | Claude Code                                 |

Agent workspaces, such as herdr, Orca, and cmux, are not in this guide. They run several agents side by side and do not maintain guidance, so they are a different category. They can run an agent that has shadowclone skills.

## pstack

pstack is a Cursor plugin with 24 skills, 21 principle skills, 22 playbooks, and 2 subagents. The `/poteto-mode` skill sends a task to the correct playbook. pstack uses the MIT license.

- **Learning.** You run `/reflect` to turn a finished task into a skill edit. pstack does not read past sessions on its own.
- **Reviews.** `/interrogate` has several models try to break a diff. The Comment Sicko subagent reviews code comments.
- **Cloud.** The Benny automation pack triages bug reports from Slack. The README does not say where it runs.
- **With shadowclone.** pstack is a set of skills. shadowclone can deliver skills to Cursor and to other agents. Two skill sets can give conflicting rules, so pick one source for each rule.

Sources: [pstack README](https://github.com/cursor/plugins/tree/main/pstack).

## Hermes Agent

Hermes Agent from Nous Research is its own agent. You start it with the `hermes` command. It uses the MIT license.

- **Learning.** The agent writes a skill after a multi-step task, after it recovers from errors, or after a correction. A write-approval gate can hold each change for your approval.
- **Storage.** Skills are `SKILL.md` files in `~/.hermes/skills/`. They follow the agentskills.io format.
- **Cloud.** Hermes runs on a VPS, a GPU cluster, or serverless infrastructure. You reach it through Telegram, Discord, Slack, WhatsApp, Signal, or email.
- **Reviews.** Not stated.
- **Difference.** Hermes learns inside Hermes. shadowclone learns from the agents that you already use and gives them the result.

Sources: [repository](https://github.com/NousResearch/hermes-agent), [skills documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills).

## Claude Code auto memory

Auto memory is part of Claude Code. Claude saves notes from your corrections and preferences. It is on by default in local sessions.

- **Storage.** Notes are Markdown files in `~/.claude/projects/<project>/memory/`, with a `MEMORY.md` index. Claude loads the first 200 lines or 25 KB of the index in each session.
- **Scope.** Each repository has one memory directory. The documentation says that memory is machine-local and does not go to other machines or cloud environments.
- **Agents.** Claude Code only. Subagents do not load the main memory, except a fork.
- **With shadowclone.** Both load in the same Claude Code session. shadowclone also carries rules to other agents and to the Actions bot.

Sources: [Claude Code memory documentation](https://code.claude.com/docs/en/memory).

## Claude Subconscious

Claude Subconscious from Letta is a background agent for Claude Code. Its README calls it a demo that is not for production use. It uses the MIT license.

- **Learning.** It reads session transcripts and learns from corrections, statements, and patterns. It sends guidance back into Claude Code through hooks.
- **Storage.** Memory belongs to a Letta agent on `api.letta.com` by default. It needs a `LETTA_API_KEY`. A self-hosted Letta server is optional.
- **Agents.** Claude Code only.
- **Difference.** shadowclone keeps learned rules as local skill files that you can read and undo.

Sources: [repository](https://github.com/letta-ai/claude-subconscious).

## imprint

imprint is a Claude Code plugin. It trains a behavioral profile from your session history.

- **Learning.** You run `/imprint:train`. It reads `~/.claude/projects/` and writes one profile.
- **Storage.** The profile is in `~/.claude/.imprint`. A session start hook loads it into each session.
- **Agents.** Claude Code only. The README does not mention other agents, cloud runs, or a license.
- **Difference.** shadowclone keeps rules in separate skills with repository scope, and it reaches more agents.

Sources: [repository](https://github.com/n33kos/imprint).
