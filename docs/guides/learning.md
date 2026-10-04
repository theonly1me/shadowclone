# Learning

Shadowclone can learn reusable instructions and corrections from the sources you enable. Model-assisted learning needs an installed and configured `claude`, `codex`, `cursor-agent`, or `pi` CLI. Antigravity supports capture and native guidance, while learning uses one of the other CLIs. [Pi setup](pi.md) describes session model inheritance and local models configured through Pi.

## Run deep learning

```bash
shadowclone learn --deep
```

Shadowclone compares eligible evidence with existing guidance and proposes changes for review. When new rules overlap, the model merges them. Every new rule ends up merged, kept as it is, or listed in the output as dropped with a reason. Pressing Enter at the review prompt leaves the learned rules pending. Approval records the rule and attempts its scoped publication within the configured learning budget. Publication may still need a repository scope or a separate conflict decision. Approval can call the model to edit a skill, but does not rerun preference extraction. If a supporting source was disabled since extraction, the rule stays pending.

```bash
shadowclone learning pending
shadowclone learning show <key>
shadowclone learning apply <key>
shadowclone learning reject <key>
shadowclone skills pending
shadowclone learning status
```

`learning pending` brings learned proposals, scope blockers, publication work, and skill conflicts into one list. A learned rule whose text reads like instructions to an agent, for example "ignore all previous instructions" or a download piped into a shell, is held there with its reasons before any model sees it, and `learn` prints how many rules it held. Rewrite such a rule with `learning replace`, or remove it with `learning retire`. `learning show` displays the rule, its proposed replacement, scope, available redacted user excerpts, capture sources, and delivery state. Disabled-source excerpts are not opened. `learning status` reports the latest private attempt receipt with the outcome and next action. Start a new agent session after a rule becomes active. Publication confirms that guidance is installed; it does not prove that an agent followed it.

Each invocation allows up to 20 model calls and five minutes. Run it again if the result says more history remains. The first pass during interactive setup is smaller, with up to 12 calls and 90 seconds.

| Option | Behavior |
| --- | --- |
| `--dry-run` | Preview without applying; this still calls the model |
| `--apply` | Accept supported proposals without the confirmation prompt |
| `--engine <id>` | Select an eligible learning engine |
| `--model <id>` | Select a model supported by that engine |
| `--reasoning-effort <level>` | Set the supported reasoning effort |
| `--max-calls <n>` | Lower or raise the attempted-call ceiling for this invocation |

Plain `shadowclone learn` indexes and reports locally after setup. A first interactive run can initialize Shadowclone and offer an authorized first learning pass. Manual deep learning follows learning consent independently of background consent.

Use `shadowclone init --advanced` to choose capture sources individually.

On Linux, Claude Code model-assisted learning needs `bwrap` and `socat` for its sandbox. Shadowclone checks for them before launching Claude and names any missing command.

## Background learning

Background learning has its own consent. When enabled, eligible steering is classified within the same bounded learning execution as manual learning. A temporary exception or an interruption alone does not become a standing preference. English cue words are not required.

```bash
shadowclone learning status
shadowclone learning enable
shadowclone learning disable
```

## Record a preference

Record repository guidance directly:

```bash
shadowclone remember --repo "Use complete variable names."
```

Use `--global` only for guidance intended for every repository. Recording a preference and publishing it into skills are separate steps. `shadowclone skills pending` shows publication work, and `shadowclone context --explain` shows what is active.

## Associate past sessions with a repository

Past sessions indexed before repository metadata consent stay isolated. With that consent enabled, setup offers each verified historical directory-to-remote association for review. You can review or bind candidates later:

```bash
shadowclone learning repositories
shadowclone learning bind <id>
shadowclone learn --deep
```

Only the confirmed directory group receives the binding. Its processed episodes are reopened for reconciliation under the verified repository scope; unrelated ledger entries stay intact. A changed remote invalidates the candidate identifier. Unknown or blocked remotes stay isolated. Binding does not make a repository rule global.

## Change or retire guidance

Inspect the rule first, then preview the exact record change:

```bash
shadowclone learning list
shadowclone learning show <key>
shadowclone learning replace <key> "Use complete words in release notes."
shadowclone learning narrow <key>
shadowclone learning retire <key>
shadowclone learning remove-source codex
```

`narrow` moves global or owner-wide guidance into the current verified repository. It retires the old record and creates a distinct repository record. It cannot move a rule to another owner or broaden its scope. `replace` makes the typed guidance a direct user decision and clears the conflicting proposal.

These commands preview without writing. After review, repeat the command with `--apply --expected <fingerprint>` using the printed fingerprint. If learning changed, apply stops for a fresh review. Each decision and subsequent publication has a reversible revision available through `history` and `undo`.

Source removal retires records with complete provenance supported only by the chosen source and rejects pending proposals with that provenance. Mixed-source records and unresolved provenance remain for individual review. It preserves original transcripts, memory, and independently existing skills. Skill edits can require bounded model calls; unfinished delivery stays visible in `learning pending`. Disable the source in configuration separately to stop future learning from it.

See [data handling](../data-handling.md) for capture, redaction, provider access, and storage boundaries.

## Review later corrections and test a response

`learning pending`, `learning show`, and `learning status` flag durable corrections that matched a rule after its recorded publication. A count asks for review; it does not prove the agent ignored the rule. After inspecting scope and delivery, use `learning acknowledge <key>` to mark those corrections reviewed without changing guidance. New corrections can raise another signal. Historical publications without recorded times are not classified retroactively.

On macOS, run one isolated Claude Code or Codex session against redacted snapshots of the installed native guidance:

```bash
shadowclone learning probe <key> --agent codex --task "Is the sample ready?" --expect "READY" --yes
shadowclone learning probe status
```

Choose a synthetic task and the exact response that would demonstrate your rule. `--yes` authorizes one paid call with a 60-second deadline; `--model` selects an installed provider model. Guidance must be published and current. Repository guidance requires an explicit local integration. The probe uses a disposable home and workspace, read access, no memory, and no hooks. It does not expose the original repository or store task or response text in its receipt. A pass establishes that one response matched; future behavior and hook delivery require separate observation. Linux and other platforms are not supported by this initial isolated probe.
