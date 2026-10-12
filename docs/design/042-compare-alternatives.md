# Compare Shadowclone with related tools

## Problem

A reader who finds Shadowclone already knows other agent tools. Some keep skills, some learn from sessions, and some run agents in parallel. The README does not say how Shadowclone differs from them. So a reader can file it as one more memory plugin or one more agent.

The README also does not say that Shadowclone is not a separate agent. It gives skills to Claude Code, Codex, Cursor, Pi, and Antigravity. The cloud bot runs Claude Code or Codex with the same skills.

## Decision

Lead the README with two promises:

1. One set of skills and instructions reaches every supported agent, so the user does not copy rules between tools.
2. The same skills reach the cloud bot, so code that the bot writes or reviews follows the same preferences.

Keep learning, bundled skills, builds, and reviews. They are the way that Shadowclone keeps that set current.

Add a short comparison table to the README. It asks five questions about each tool:

1. What is it?
2. Which agents does it cover?
3. Does it learn from sessions?
4. Does the same guidance reach the cloud?
5. Does it review pull requests?

| Tool                    | Why it is in the table                                   |
| ----------------------- | -------------------------------------------------------- |
| pstack                  | A skill pack that also shapes how an agent works         |
| Hermes Agent            | An agent that writes its own skills from experience      |
| Claude Code auto memory | Built-in learning from corrections in one agent          |
| Claude Subconscious     | A background agent that learns from Claude Code sessions |
| imprint                 | A profile trained from Claude Code session history       |

Agent workspaces, such as herdr, Orca, and cmux, stay out of the table. They run agents side by side and do not maintain guidance. A row for them suggests that they compete with Shadowclone, but they are a different category.

Add `docs/guides/comparison.md` with one section for each tool. Each section says what the tool is, how it differs, whether it can run with Shadowclone, and its primary sources.

Use only facts from each project's own repository or documentation. Write "not stated" when those pages do not answer a question. Record the date of the check on the page.

Work in this order:

1. Add this record and its index row.
2. Revise the README opening and add the table.
3. Add the comparison guide and link it from the documentation index, the README docs table, and the motivation page.
4. Run `bun run lint` and `bun run check`.

## Consequences

The table names other projects, so it can become wrong when they change. The date line tells the reader how old the check is. A later check replaces the table and the date in one commit.

The table must not claim that a tool lacks a feature when its pages only fail to mention it. "Not stated" keeps that difference visible.

## Verification

- Open each source link and compare it with each cell.
- Run `bun run lint`, which checks plain English and relative links.
- Run `bun run check` before the pull request.
