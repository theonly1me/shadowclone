# Narrow capture, learning evidence, and delegation

## Problem

Shell history is the riskiest capture source and the least useful one. Commands carry credentials more often than agent prompts do, and redaction is pattern based. A command also lacks the preceding agent turn, so it rarely explains why a user changed direction.

Learning evidence can include text the agent wrote. `plan-presented` and `question-asked` events count as eligible evidence, and `allowlistedSignals` accepts assistant references as `textRefs`. A rule can then rest on agent text alone, including text copied from a tool result or a web page.

`shadowclone run` duplicates the headless modes that Claude Code, Codex, and Cursor already provide. It also carries its own worktree, gate, receipt, and remote-action code that the task harness only partly shares.

## Decision

Remove the `shell` source. Delete its adapter and setup question. Schema version 7 deletes `shell` rows from `events`, `cursors`, `origin_binding_timeline`, and `origin_bindings` when an older index opens. Config parsing and managed policy parsing ignore a `shell` entry left in an older file, and they still reject any other unknown source.

Make learning evidence user-authored only. User prompts, question answers, plan resolutions, interruptions, and permission denials stay eligible. Agent-written events become context: the reconciliation prompt already labels it "Preceding assistant context (not user evidence)", and it can explain a short correction without supporting a rule on its own.

Remove `shadowclone run` and the dispatch code that only it uses. Keep the modules that `src/tasks/` imports, which are command execution, the verification gate and sandbox, worktree push, and remote-action drafts. `~/.shadowclone/runs/` stays because task records share it.

The sequence is three pull requests: source removal, evidence narrowing, then `run` removal. Each lands with its tests and documentation.

## Consequences

Users who enabled shell history lose that evidence. Guidance it already produced stays published until the user retires it through the existing review surface.

Learning may produce fewer rules from sessions where the user only accepted or declined an agent plan. Those sessions still contribute context to corrections the user wrote.

The task harness stays unchanged. A separate evaluation decides whether it remains.

## Verification

Migration tests open a version 6 index with `shell` rows and confirm version 7 keeps only other sources. Config and managed policy tests parse files that still name `shell`. Learning tests confirm agent-written text alone yields no evidence and still reaches the reconciliation prompt as context. CLI tests confirm `run` is no longer a command, while `task` and the `shadowclone_task` MCP tool still work. `bun run check`, including `knip`, passes after each pull request.
