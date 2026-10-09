# Learning

Shadowclone learns reusable instructions and corrections from the sources that you enable. Learning with a model needs an installed and configured `claude`, `codex`, `cursor-agent`, or `pi` CLI. Antigravity supports capture and native guidance, and learning uses one of the other CLIs. [Pi setup](pi.md) explains how learning inherits the model of a Pi session and how to use local models.

To choose which sources Shadowclone can read, run `shadowclone init --advanced`.

## Run deep learning

```bash
shadowclone learn --deep
```

Shadowclone compares eligible evidence with your existing guidance and proposes changes for you to review. If new rules overlap, the model merges them. Each new rule ends up merged, kept as it is, or dropped with a reason in the output. Press Enter at the review prompt to leave the learned rules pending.

Each run allows up to 20 model calls and 5 minutes. Run it again if the result says that more history remains. The first pass during interactive setup is smaller, with up to 12 calls and 90 seconds.

| Option                       | Behavior                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `--dry-run`                  | Preview without applying. This still calls the model.      |
| `--apply`                    | Accept supported proposals without the confirmation prompt |
| `--engine <id>`              | Choose an eligible learning engine                         |
| `--model <id>`               | Choose a model that the engine supports                    |
| `--reasoning-effort <level>` | Set the reasoning effort that the engine supports          |
| `--max-calls <n>`            | Lower or raise the ceiling of attempted calls for this run |

Plain `shadowclone learn` indexes and reports on your machine, with no model call. A first interactive run can start setup and offer a first learning pass. Manual deep learning follows learning consent, and background consent does not affect it.

On Linux, learning with Claude Code needs `bwrap` and `socat` for its sandbox. Shadowclone checks for them before it starts Claude and names any missing command.

## Review learned rules

```bash
shadowclone learning pending
shadowclone learning show <key>
shadowclone learning apply <key>
shadowclone learning reject <key>
shadowclone skills pending
shadowclone learning status
```

`learning pending` lists learned proposals, scope blockers, publication work, and skill conflicts in one place. `learning show` displays the rule, its proposed replacement, its scope, the redacted user excerpts, the capture sources, and the delivery state. It does not open excerpts from a disabled source.

Approval records the rule and tries to publish it in its scope, inside the learning budget. Approval can call the model to edit a skill. It does not run preference extraction again. Publication can still need a repository scope or a decision about a conflict.

- If a skill draft fails validation, the model gets one repair turn with the exact error.
- If the repair fails, or no learning call is left, the rule stays pending with both errors.
- If a source that supports the rule is now disabled, the rule stays pending.
- If the text of a learned rule reads like an instruction to an agent, Shadowclone holds it before any model sees it. Examples are "ignore all previous instructions" and a download that pipes into a shell. `learn` prints how many rules it held. Rewrite such a rule with `learning replace`, or remove it with `learning retire`.

`learning status` shows the latest private attempt receipt with its outcome and next action. Start a new agent session after a rule becomes active. Publication confirms that Shadowclone installed the guidance. It does not prove that an agent followed it.

## Background learning

Background learning has its own consent. When you turn it on, Shadowclone classifies eligible steering inside the same bounded execution as manual learning. A temporary exception or an interruption alone does not become a standing preference. The cue words do not need to be English.

```bash
shadowclone learning status
shadowclone learning enable
shadowclone learning disable
```

## Record a rule

Record repository guidance yourself:

```bash
shadowclone remember --repo "Use complete variable names."
```

Use `--global` only for guidance that applies to every repository. Recording a rule and publishing it into skills are separate steps. `shadowclone skills pending` shows the publication work, and `shadowclone context --explain` shows the active guidance.

## Link past sessions to a repository

Sessions that Shadowclone indexed before you gave Git metadata consent stay isolated. After you give that consent, setup offers each verified link from a past directory to a remote for review. You can review or bind the candidates later:

```bash
shadowclone learning repositories
shadowclone learning bind <id>
shadowclone learn --deep
```

Only the confirmed directory group gets the binding. Its processed episodes open again for reconciliation under the verified repository scope. Unrelated ledger entries stay as they are. A changed remote makes the candidate identifier invalid. Unknown or blocked remotes stay isolated. Binding does not make a repository rule global.

## Change or retire guidance

Inspect the rule first, then preview the exact change:

```bash
shadowclone learning list
shadowclone learning show <key>
shadowclone learning replace <key> "Use complete words in release notes."
shadowclone learning narrow <key>
shadowclone learning retire <key>
shadowclone learning remove-source codex
```

- `narrow` moves global or owner-wide guidance into the current verified repository. It retires the old record and creates a separate repository record. It cannot move a rule to another owner or widen its scope.
- `replace` makes the typed guidance your direct decision and clears the conflicting proposal.
- `remove-source` retires records whose full provenance comes only from the chosen source. It rejects pending proposals with that provenance. Records from mixed sources and records with unresolved provenance stay for single review. It keeps original transcripts, memory, and skills that exist on their own.

These commands preview first and write nothing. After you review, repeat the command with `--apply --expected <fingerprint>` and the printed fingerprint. If learning changed in the meantime, apply stops so that you can review again. Each decision and each later publication has a revision that you can read with `history` and reverse with `undo`.

Skill edits can need bounded model calls. Unfinished delivery stays visible in `learning pending`. To stop future learning from a source, disable the source in the configuration.

## Review later corrections and test a response

`learning pending`, `learning show`, and `learning status` flag durable corrections that matched a rule after its recorded publication. A count asks for a review. It does not prove that the agent ignored the rule.

Inspect the scope and the delivery. Then run `learning acknowledge <key>` to mark those corrections as reviewed without a change to the guidance. New corrections can raise another signal. Shadowclone does not classify old publications that have no recorded time.

On macOS, you can run one isolated Claude Code or Codex session against redacted snapshots of the installed native guidance:

```bash
shadowclone learning probe <key> --agent codex --task "Is the sample ready?" --expect "READY" --yes
shadowclone learning probe status
```

Choose a synthetic task and the exact response that would show your rule at work. `--yes` authorizes one paid call with a 60-second deadline. `--model` chooses an installed provider model. Publish the guidance first, and keep it current. Repository guidance needs an explicit local integration.

The probe uses a disposable home and workspace, read access, no memory, and no hooks. It does not expose the original repository. Its receipt holds no task text and no response text. A pass shows that one response matched. Future behavior and hook delivery need separate observation. The probe supports macOS only.

See [data handling](../data-handling.md) for capture, redaction, provider access, and storage.
