# Acting

Shadowclone supports live installed agents and unattended worktrees. The permissions differ between these paths and must not be conflated.

## Live agents

`shadowclone install` writes a compiled agent definition into the current repository. The host agent session decides its tools and approvals. The installed profile supplies behavioral guidance; it does not add the headless OS boundary to that session. The optional delegation skill routes bounded tasks to this agent.

## Headless policy

Invoking `shadowclone run "<task>"` authorizes one local worktree, branch, and commit of a successful agent result. The agent receives inspection, editing, and supported verification tools. Native hooks, ambient settings, integrations, and session persistence are disabled. An outer process boundary confines writes and protects source and control state. The provider's Bash sandbox adds filesystem and network restrictions.

Repository ceilings and per-run grants are intersected with managed policy. An empty remote allowlist still permits the authorized local task. Remote operations need both a matching repository entry and a grant on that invocation:

```toml
[repo."github.com/example/project"]
allow = ["push", "pr-draft", "pr-reply"]
maxBudgetUsd = 2.00
```

```bash
shadowclone run "prepare the fix" --approve push --approve pr-draft
shadowclone run "reply with the review findings" --approve pr-reply --pr 123
```

Named repository ceilings require Git metadata consent. A draft PR also requires push approval. PR replies require a positive target PR number. GitHub operations use host helpers with the resolved repository and explicit arguments. The agent supplies structured draft text, not a shell command or repository selector, and does not receive a GitHub token.

Automatic host Git operations disable hooks, file monitors, signing, and ambient global configuration. Executable local filters and unsupported transports are refused. Push targets the resolved branch on origin; force push and merge are not granted.

## Run lifecycle

The host resolves policy, creates a private worktree, compiles the selected profile, and starts a bounded agent process. A successful engine result is committed locally. Approved remote actions run through host helpers. A private receipt records identifiers, timing, changed paths, commits, and action outcomes. The worktree remains for review.

A successful engine result is not proof that every available verification command ran. `actionsBlockedByPolicy` lists unavailable capabilities, not evidence that the agent tried them. Native session persistence is disabled, so a receipt does not promise a provider transcript file.

Branches use an opaque run suffix and a fixed task prefix. Receipts retain a task hash without raw task text or a task-derived slug. Repository identifiers and changed relative paths remain potentially identifying private data. Inspect receipts before sharing them.

## Resource and trust limits

Provider output is bounded, and overflow or cancellation terminates the process group. A provider-supported cost limit is requested, but in-flight billing may exceed the nominal amount. Unsupported isolation fails closed. These controls do not certify the provider runtime or operating system.

Learning from later review, merge, or rejection of the resulting branch is not implemented. Session-end ingestion updates structural evidence; explicit deep learning reconciles eligible profile changes.
