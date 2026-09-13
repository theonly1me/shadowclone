# Profile

The profile gives the main agent and optional clones the user's engineering preferences. One compiler serves native installations, hooks, MCP, dispatch, and evaluation.

Native instruction files hold a stable managed pointer. Session-start hooks compile and inject the current global, matching organization, and exact repository guidance for the active working directory. Native writes preserve surrounding instructions, fingerprints protect edited managed content, and `shadowclone sync` refreshes recorded pointers and hooks. `shadowclone context` exposes the same scoped compiler through the CLI.

It is a directory of markdown at `~/.shadowclone/profile/`. You can read it, edit it, delete a line you disagree with, commit it to a private repo, or hand it to a teammate. It is not embeddings and it is not a database, because a user who cannot read what was learned about them cannot consent to it.

## Seed guidance

The package keeps profile preferences and Agent Skills separate because they serve different purposes.

Eight concise preferences under `preferences/` record choices across dependency posture, planning threshold, question frequency, and refactor tolerance. Ten Agent Skills under `skills/<name>/SKILL.md` carry routing descriptions, task-specific process, guardrails, and completion evidence. Testing approach is the one skill axis; the other eight skills are independently selectable.

The comment-policy axis is absent. Repository comment practice comes from imported rules and learned evidence.

`shadowclone skills` lists both forms without reading or writing the user's profile. Default `shadowclone init` shows detected sources, asks three grouped consent questions, then imports repository guidance and runs a bounded first learning pass when enabled. `init --advanced` keeps the detailed source and seed wizard flow. `shadowclone wizard` reruns preference and starter-skill choices. Each selected preference becomes an active global declared rule under the stable key `seed:<guidance-id>` after confirmation.

Each selected Agent Skill is installed as a complete directory into canonical `~/.agents/skills` and replicated to supported Claude Code, Codex, Cursor, and Antigravity-compatible personal skill locations. One changed copy becomes authoritative during synchronization. Different changes in multiple copies create a conflict and preserve every version. A deselected unedited starter is removed; an edited starter becomes adopted user content. Existing personal skills are never silently replaced.

An identical rerun produces the same profile and skill library. Choosing a preference sibling retires the prior unedited axis rule. Editing a seed preference transfers ownership to the user, and deleting one records a rejection, so later wizard runs preserve both decisions. Imported, mined, and manual rules remain outside the seed lifecycle.

## Repository guidance import

`shadowclone init` imports supported repository guidance after grouped consent when it detects guidance. `init --advanced` asks about the import explicitly, and `shadowclone import` runs the same synchronization independently. The importer reads root `CLAUDE.md`, root `AGENTS.md`, root `.cursorrules`, and direct skill files under `.claude/skills/` or `.agents/skills/`. Every file is one profile rule. Skill frontmatter is removed, headings are nested beneath the rule title, and fenced code remains intact.

Import is deterministic and calls no engine. A `FileTextRef` reaches `resolveRedacted` before Markdown is transformed or stored. Each rule carries a hashed source locator and hashed aliases for its canonical working directory and, when enabled, remote repository. The state contains no raw source path or remote URL.

An unchanged rerun is byte stable. Source edits revise an unedited rule under the same key. Profile edits remain user-owned, deletions remain rejected, removed sources retire, and renamed sources receive new identities. A Git-identified import lives at `org/<origin>/projects/<safe-name>--<identity-hash>.md`; an import without Git metadata remains under its opaque isolated origin. The compiler admits only the exact project file for the active repository.

## Evidence and learning

Sending 562 MB to a model is not affordable. The work splits by whether it needs a model at all.

**Structural signals cost zero tokens.** They are computed in pure code over the index. Session and origin counts, tool histograms, plan activity, interruptions, permission denials, answered questions, and resolved plans form the mirror. They are evidence about how a person works, not instructions, so this path reports them without writing profile rules.

**Semantic learning costs tokens.** A separate stream groups consecutive user messages with the preceding assistant explanation. Eligible pointers and the existing profile pass through the redaction gate. Reconciliation must identify durable preferences, corrections, or approvals before evidence can reinforce, contradict, narrow, or create a rule. Additional context, temporary exceptions, cancellation, unknown intent, bare interruptions, and bare tool refusals do not independently support guidance.

`shadowclone learn` updates the local index and prints the structural report. It leaves every profile file unchanged. `shadowclone learn --deep` takes the 60 oldest episodes absent from the learning ledger, admits at most ten reconciliation batches, reports how many episodes remain, shows the proposed reconciliation, and asks once before writing. The ledger is durable, so successive runs advance through the whole history and no episode is reread. `--max-calls <n>` scales the call, time, and episode ceilings together. The remaining part of the default 20-call allowance is available for rule consolidation and enabled skill maintenance. `--deep --dry-run` runs the profile analysis with an in-memory index and no checkpoint or profile write. `--deep --apply` skips the confirmation. Engine, model, and reasoning effort can be selected explicitly for reproducible maintenance.

Default setup selects the newest unprocessed episodes for one concurrent wave of reconciliation with a 90-second whole-run limit. It applies completed reconciliation results in input order. A deadline ends the first pass without failing setup, and later learning can resume from completed checkpoints. Claude's `SubagentStart` hook injects the same compiled profile into spawned subagents without making another learning request.

A separate automatic-learning opt-in lets the main agent mark a substantive session that contains an explicit reusable preference or clear correction. The native hook supplies an opaque `learn --session` token, stores only a hash of the provider session identifier, and schedules bounded learning after both the agent request and session end. A stop, extra context, cancellation, question, temporary exception, silence, or session boundary does not schedule learning alone. A SQLite transaction serializes workers. Daily hash ledgers avoid repeated evidence processing without storing transcripts.

Profile writes record local before/after revisions and compare destinations before applying. Failed multi-file writes roll back completed changes. History can restore a completed or partially prepared revision when its destinations still match; it refuses to overwrite later manual edits. `shadowclone remember` records an explicitly supplied repository or global preference without inference. CLI and MCP operations do not expand execution authority.

## Correction mining

The following historical counts describe observable events, not labeled preferences. An interruption is often just a pause while the user supplies more information. Production learning uses user steering episodes and semantic assessment, not these counters.

The counts below came from one 562 MB corpus of 372 sessions. They describe structural markers, not evaluated rules.

**Interruption, 994 found.** Claude Code writes the marker `[Request interrupted by user`. The report counts it and the interrupted tool family without assuming disapproval.

**Tool denial, 445 found.** The mirror reports refused permission requests by tool family. A refusal alone supplies no preference evidence and cannot create a blanket tool rule.

**Question answered, 313 found.** An `AskUserQuestion` call paired with the option the user picked.

**Plan resolution, 570 plan calls found.** An `ExitPlanMode` call and the following user turn indicate approval or redirection.

**Undo.** An edit that reverts a region the agent wrote in the same session. Not yet counted.

**Correction prompt, 13 found in 682 prompts.** A user turn opening with no, don't, actually, instead, revert, or wrong. The low marker rate means learning cannot depend on this form alone.

Structured markers reliably establish that an interaction happened. They do not establish the user's intent. Only assessed durable user evidence reaches rule reconciliation.

The miner runs over the index and emits `Signal` values holding `TextRef` pointers. Text is materialized only inside `src/distill/`, once, redacted, and dropped.

## The mirror

`shadowclone learn` prints measured evidence without changing the profile. A developer has rarely been shown how they actually work with an agent, and the terminal output is where that becomes visible, so its shape is specified here as a stable CLI contract.

The report shows session counts, interaction markers, tool use, and a preview of eligible learning work. It contains no captured excerpts.

The report follows five rules.

The first line states corpus and allowed-origin counts and whether an engine call was made. Plain learning always states that no network call was made.

Correction kinds are counted separately before ranked categories, with interruptions first.

Every line carries a count. A count is a claim the user can dispute and an adjective is not.

Nothing in the output is captured text. Category labels are derived and tool names are tool names. Working directories, origin identifiers, source paths, repository names, and excerpts are absent.

The last section previews how many pointer-bearing moments and reconciliation batches explicit deep learning would process. Plain learning then states that the profile stayed unchanged.

The report should show user behavior that is hard to infer from a generic instruction file.

## Files

The layout is scoped by the remote owner a rule was learned from, because a rule learned under one employer or account must not be injected into a session under another. `normalizeRemoteOrigin` represents that boundary as `host/owner`. `07-enterprise.md` covers the boundary in full and this is the shape it produces.

```
~/.shadowclone/profile/
  global/
    identity.md
    workflow.md
  org/
    github.com--acme/
      engineering.md
      boundaries.md
      projects/platform.md
    github.com--atchyut/
      engineering.md
  .rejected
  .generated
```

`.generated` is a JSON Lines lifecycle ledger. A present entry holds the rule id, relative path, source, and last generated title and body, which lets the writer recognize a deletion after the Markdown is gone. A retired entry is a tombstone for obsolete generated guidance. `.rejected` holds deleted ids with the same generated text so later reconciliation can compare a new candidate with what the user removed. Legacy 0.0.5 rows contain only a path and key, and their missing text is never invented.

| File | Holds |
| --- | --- |
| `identity.md` | Voice and register. How this person writes, from their own prompts. |
| `engineering.md` | Stack, conventions, what good looks like in a diff. |
| `workflow.md` | How they drive an agent. Plan first, scope tight, verify before presenting. |
| `boundaries.md` | What the user has denied and where the agent should ask. Advisory until denials identify the action. |
| `projects/<repo>.md` | Per repo specifics that do not generalize. |

A rule starts under the `host/owner` identity where it was observed. It moves to `global/` when it has been observed under two or more distinct owners, because a habit that survives across those boundaries belongs to the person, or when the user promotes it by hand. Compilation for a target repo reads `global/` plus the one matching owner directory and nothing else. Repository-specific profile files are supported under that owner at `projects/<repo>.md`, but mined rules currently target owner or global scope.

## Provenance

Every rule carries where it came from.

```markdown
## Runs typecheck and tests before presenting a diff

Never presents work as finished without running `bun run typecheck && bun test` first, and says which one was run.

<!-- shadowclone: {"schema":1,"key":"018f7d34-45aa-7a3c-8912-61fc10928d67","source":"mined","status":"stale","proposal":null,"applies-when":[],"supports":2,"contradicts":1,"evidence":{"for":["event:one","event:two"],"against":["event:three"]},"observations":3,"last-seen":"2026-09-08","sessions":2,"origins":["github.com/acme"],"scope":"org","fingerprint":"e39c293f6c04933a"} -->
```

The trailing metadata is HTML comment syntax so it renders as nothing when the file is read as markdown, and parses reliably when the file is read back. This is the one place in the project where a comment is written, and it is data, not commentary.

`source` distinguishes guidance the user declared or wrote from imported and mined guidance. `status` is active, candidate, or stale. Declared, imported, and user-owned guidance stays active during disagreement while `proposal` carries a pending revision or narrowing for the user to decide. Contradicted mined guidance becomes stale. A model-assessed explicit reusable preference or correction can activate from one independent session; inferred mined guidance needs three supporting sessions.

Evidence is separated into `for` and `against` identifiers and deduplicated before `supports` and `contradicts` are counted. Current identifiers carry origin, session, timestamp, signal kind, and category. Merged rules union the evidence of their named source rules, and wording changes retain the first constituent's persistent id. Confidence is absent because the previous structural and semantic paths gave the same number two incompatible meanings.

`applies-when` carries explicit conditions for registry and imported guidance. The compiler renders those conditions beside the rule so the agent applies it in the stated context. It does not match them against task text, because the stored conditions are natural language instructions and substring matching would turn prose into an accidental query language.

## One compiler

`compileProfile` is the only projection from stored profile to agent-facing guidance. Native hooks, MCP recall, optional subagent installation, headless dispatch, transfer evaluation, and the offline cache all call it. It accepts either a profile directory or a set of rules already produced from redacted evidence, and both go through the same selection, rendering, conflict, and budget code.

Directory compilation opens a closed set of paths: `identity.md`, `engineering.md`, `workflow.md`, and `boundaries.md` under `global/` and the matching owner, plus the one exact `projects/<repo>.md` for the active repository. It enumerates no other owner and no other repository. Raw file text supplies identity, source, lifecycle, and counts. Every title, body, and condition placed in agent-facing guidance comes from a whole-file `FileTextRef` resolved through `resolveRedacted`.

Selection is deterministic for identical inputs. Candidate and stale rules are omitted first. User-written, declared, and imported guidance forms one tier that sorts ahead of mined guidance, then higher observation count, then persistent key, then content. A seed axis admits one choice, so a declared choice always wins over a mined sibling and the loser is reported as an axis conflict.

The complete output is capped at 16,384 UTF-8 bytes including the preamble, separators, source labels, and conditions. A block is admitted only when it fits whole, and a block that does not fit is omitted while later smaller blocks stay eligible. No heading, condition, rule body, code fence, or multi-byte character is ever sliced.

The result reports the applied rule keys, the applied block count, and every omission with its reason: candidate, stale, axis conflict, or budget. Dispatch receipts use the applied count, so nested headings inside a projected Agent Skill do not inflate it.

## Delivering to agents

`shadowclone install` defaults to a global Claude Code main-agent integration. Claude Code, Codex, Cursor, Antigravity, or all supported agents can be selected, and repository scope remains available. Each integration writes a stable managed pointer, a small context skill, and lifecycle hooks using the provider's native locations. The session-start hook calls `compileProfile` for the active working directory, so the next session sees profile changes without copying current rule text into every provider instruction file.

Native installation records owned destinations and fingerprints in `~/.shadowclone/integrations.json`. `shadowclone uninstall` removes the selected integration and preserves surrounding user content. `forget --all` removes every recorded integration before removing Shadowclone's home directory. `05-privacy.md` covers the manifest.

The Claude subagent remains an explicit repository option. `--subagent` writes `.claude/agents/shadowclone.md` from the same compiled profile and records it in `.git/info/exclude`. `--auto-delegate` also writes `.claude/skills/shadowclone/SKILL.md` for bounded independent tasks. Claude's `SubagentStart` hook also injects the current profile into spawned subagents without a second learning request.

Scope applies at compile time for every consumer. A session hook or optional subagent receives global rules, the matching remote owner's organization rules, and only the exact matching project file. It receives nothing from another owner or repository.

## Hand edits and lifecycle

The user editing their own profile is the point, so regeneration must never clobber it.

The writer parses the existing file first. A generated block whose visible title or body no longer matches its stored fingerprint becomes active user guidance, leaves generated ownership, and is carried forward verbatim. A generated block removed while the same persistent id is proposed moves to `.rejected` with its last generated text. Later wording revisions under that id remain rejected.

Creation adds an unseen id, revision replaces unedited text under the same id, pinning preserves user text, rejection honors user deletion, and explicit retirement removes obsolete generated text without recording user rejection. Absence from one generation run does not retire a rule. Unedited 0.0.5 blocks migrate into current-schema rules with empty evidence, keeping their stored observation counts and activating on the same three-session bar as any other mined rule. Edited legacy blocks become user-owned and keep their text. A write that would drop a stored rule without an explicit retirement fails instead.

Deep reconciliation compares each proposed new rule with a redacted view of these rejection records. A semantic match names an opaque rejection token and is omitted before any new profile key or Markdown block is created.

## Budget and resumption

Deep distillation runs against the user's own subscription quota, which is a real and exhaustible resource. The execution budget is explicit.

Work is batched by origin and exact repository. Up to eight independent reconciliation batches run concurrently, and their results apply in input order. Completed batches are checkpointed to `~/.shadowclone/distill/` before consolidation. A reconciliation checkpoint hashes the complete redacted prompt, output schema, and learner version, so changes to evidence, existing guidance, rejections, or the model contract invalidate stale output. One learning execution owns reconciliation and merge, with a default limit of 20 attempted calls and five minutes. Claude also receives a cumulative $2 ceiling. Codex and Cursor are bounded by calls and time because they cannot enforce a dollar flag. A stopped run keeps completed checkpoints and resumes from unfinished work.

`shadowclone learn --deep` prints the batch count and applicable execution limits before the first model call, then prints a rule-level comparison before any profile write.
