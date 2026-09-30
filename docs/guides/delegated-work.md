# Delegated work

The optional `shadowclone-work` skill carries an engineering task from your existing agent session to a verified review handoff or explicitly authorized shipping. Choose it in `shadowclone wizard`, review the build, and apply it. It uses existing repository requirements and personal skills; importing session history is optional.

The task helpers support Claude Code and Codex identifiers. Native delegation and model behavior require host qualification before being advertised as production-ready. Cursor task qualification is deferred. Native approvals still apply, and task helpers cannot prevent an agent from using other host tools.

## Trigger inside your agent

After installing a CLI release containing this workflow, open `shadowclone wizard`, equip **Work with Maintained Engineering Standards**, review the build, and apply it. Start a new session in the repository so the agent discovers the installed `shadowclone-work` skill. The Shadowclone plugin supplies the local MCP connection; the skill also supports CLI operations when MCP is unavailable.

In Claude Code, invoke the installed personal skill directly:

```text
/shadowclone-work Add pagination to the results endpoint using my engineering standards and leave the change ready for review.
```

In Codex, select the skill with its native invocation:

```text
$shadowclone-work Add pagination to the results endpoint using my engineering standards and leave the change ready for review.
```

Both hosts can also select the installed skill from a plain-language request, i.e. "Use the shadowclone-work skill to implement this task and return a verified review handoff." Explicit invocation makes the selected workflow clear. The agent handles task records, guidance delivery, verification, and review; the user does not need to prepare task JSON.

## Start with one task

Tell your agent to use `shadowclone-work`, describe the result, and state whether the finish line is review or shipping. Review is the default. The agent records acceptance criteria, file scopes, the actual session identifier, relevant guidance, and verification recipes using the `shadowclone_task` MCP tool. The CLI exposes the same operations:

```bash
shadowclone task start --input /private/task-input.json
shadowclone task status TASK_ID
shadowclone task verify TASK_ID
shadowclone task list
```

Keep input files outside the repository, or pass JSON through `--input -`. A minimal synthetic input is:

```json
{
  "title": "Add a counter command",
  "host": "codex",
  "sessionId": "replace-with-the-current-native-session-id",
  "acceptance": ["The counter command prints its incremented value"],
  "scopes": ["src/counter", "tests/counter"],
  "verification": [{
    "name": "counter command",
    "kind": "cli",
    "prerequisites": ["command -v bun"],
    "run": ["bun test tests/counter"],
    "cleanup": []
  }]
}
```

Task records live under `~/.shadowclone/runs/<id>/task.json`. Guidance snapshots and selected skill resources live beside the record. Existing headless-run receipts keep their original format. Nothing is committed or sent to GitHub by task start.

## Guidance, checks, and review

The receipt distinguishes selected guidance, an agent's delivery acknowledgment, executed checks, and a review assessment. Reading a skill does not prove compliance. Shared repository requirements take precedence over personal defaults.

The task freezes the repository gate and optional `verification` recipes in `.shadowclone/harness.json`. Each recipe has a name, kind (`test`, `cli`, or `ui`), prerequisite commands, setup commands, run commands, evidence paths, and cleanup commands. Task-specific recipes add to repository requirements. Repository refresh preserves recipes. Missing prerequisites or evidence produce an incomplete result. Cleanup runs after attempted setup, including setup failure.

Verification holds a per-task operation lock while commands run. Other tasks can still checkpoint, and pausing interrupts the verifier before more work is dispatched. A crashed verifier leaves a recovery marker and cannot produce readiness until the task is explicitly resumed.

New or changed repository instruction files invalidate the guidance snapshot. Workers check the requirements in their own checkout as well as the coordinator's selected guidance.

Verification uses the existing offline sandbox without credentials. It protects Git metadata and private task state from writes. A recipe requiring unavailable networking or UI capabilities remains incomplete; do not silently run it with broader permissions. Install needed dependencies separately under the user's existing authorization.

Snapshots include tracked contents, untracked contents, file modes, the index, branch, and head. Source changes during verification invalidate its result. Later changes invalidate verification and review. Large files, oversized workspaces, external symlinks, and submodule directories that cannot be checked are explicit blockers. A task with no executable verification cannot be ready.

Substantive changes require a different reviewer session to acknowledge the guidance and address every acceptance criterion. Small changes can use the current session. Review results are attributed agent assessments, not security attestations. One failed verification cycle allows one recorded repair and retry. A successful cycle can be rerun after later changes.

## Parallel work and recovery

Use one coordinator per repository and one task writer per worktree. Native agents create or select worktrees under existing user authorization; task helpers do not create branches. Worker tasks identify their coordinator, dependencies, and bounded file scopes. They inherit the coordinator's frozen guidance and required checks. Overlapping scopes and more than two active workers are rejected. The first worker acknowledges its actual workspace and guidance before a second starts. Unqualified routing uses serial work.

An MCP server is bound to its launch directory. A worker in another worktree must use a server launched there or invoke the CLI from that worktree. The coordinator must not edit worker-owned files. Host sessions own their tools and processes; the local reservation does not sandbox those sessions.

Dependencies must be completed, committed, and ancestors of the new task's head. Integrate independent results using authorized Git operations or reviewed file edits. Record an `integration` checkpoint with `childId` and `childSnapshot` after the worker's changed files match in the coordinator worktree. A completed worker alone does not establish integration. Verify and review the combined change before handoff.

`task pause TASK_ID` retains reservations and pauses recorded children. Stop native workers separately. Cancel only after they and any verification cleanup have stopped using `task cancel TASK_ID --sessions-stopped`. Pending remote effects must be reconciled first. Resume with a JSON input containing the new `sessionId` and `previousSessionStopped: true`; optional `actions` can narrow the previous allowance. Resume rereads current guidance and grants and requires fresh evidence. Changed harness requirements require a new reviewed task.

`forget --all` refuses unfinished tasks and existing managed worktrees before deleting data. Preserve or remove worktrees explicitly after reviewing their contents and unpushed commits.

## Explicit action grants

An owner can save grants in their interactive terminal:

```bash
shadowclone task grant commit,push,pr-create,pr-reply,merge
shadowclone task grants
shadowclone task revoke
```

The CLI shows the repository and actions and asks for confirmation. There is no noninteractive approval flag and MCP cannot create grants. Choose only the actions you want. Grants are private, scoped to the repository identity and local Git repository, and intersected with managed policy and the task's `actions` list. A task's skills cannot authorize an action. Revoking a grant invalidates existing task readiness; resumption can adopt the narrowed allowance.

`task action TASK_ID --input <private-json-file>` accepts a single action: commit with a conventional subject, push, PR creation with title/body and optional `draft`, PR reply with body, or merge. Merge additionally requires the task's `finish` to be `ship`. Automatic commits refuse worktrees that were dirty when the task began. A commit changes the recorded head and requires refreshed verification and review before pushing. Push sends the exact verified commit without force. PR creation defaults to draft.

GitHub maintenance is restricted to the recorded repository, branch, and the authenticated account's own PR. Merge requires a clean verified workspace, current-head local review, confirmed required CI checks, applicable GitHub approvals, and GitHub mergeability. The merge command uses `--match-head-commit` and never bypasses branch protection. A queue request stays pending until GitHub confirms the merge. Marking a draft ready remains an explicitly authorized host action.

If the CLI cannot provide a required-check list, the helper checks all reported CI jobs. Missing or unreadable check evidence stays incomplete. It does not interpret error prose as permission to merge.

`task maintain TASK_ID` reports one PR observation and untrusted review feedback. The native session handles fixes and can repeat observations within its bounded workflow. No daemon runs after the session ends. Remote feedback and command output do not enter learning. An explicit user correction can use the existing preference service through a correction checkpoint.

Every action saves intent before execution. If interrupted, use `task reconcile TASK_ID`; helpers inspect existing effects without repeating the action. If an effect cannot be proved, the owner must inspect it. Only the interactive CLI can confirm a specific intent was not applied with `--not-applied ACTION_ID`. This preserves the original intent instead of hiding it.

## Measure useful throughput

An `outcome` checkpoint accepts user-reported acceptance, review minutes, repeated corrections, regressions, interventions, and optional provider cost. Unknown costs remain unknown. The preference-study receipt supports the same optional outcome fields.

Freeze independently authored held-out tasks before examining preference coverage:

```bash
shadowclone eval --protocol workflow-outcomes-v1 --phase freeze --tasks-file /private/tasks.json --output-directory /private/workflow-study
shadowclone eval --protocol workflow-outcomes-v1 --phase report --suite-file /private/workflow-study/workflow-suite.json --results-file /private/results.json
```

The task file is an array of `id`, `prompt`, and `acceptance` records. Results identify the suite fingerprint, task, repeat, condition (`existing-skills`, `current-shadowclone`, or `evolved-workflow`), host, host version, model, budget, product revision, start time, and user-reported outcome. Reports compare only complete groups matched on task, repeat, host, version, model, and budget. Duplicate cells, unknown tasks, altered task definitions, and runs predating the freeze are rejected. Missing cells and costs stay visible.

These commands make no model calls. They reuse the evaluation framework's private storage and locking. Authenticated runs need an explicit scope and budget. Descriptive outcomes do not establish superiority. The adoption pilot starts with five experienced engineers and one small team, measuring completed work and return use the following week before broader claims.
