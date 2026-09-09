# Profile

The profile is how a clone knows what you would have done. Everything before it is plumbing and everything after it is a clone reading it.

It is a directory of markdown at `~/.shadowclone/profile/`. You can read it, edit it, delete a line you disagree with, commit it to a private repo, or hand it to a teammate. It is not embeddings and it is not a database, because a user who cannot read what was learned about them cannot consent to it.

## Seed guidance

The package keeps profile preferences and Agent Skills separate because they serve different purposes.

Eight concise preferences under `preferences/` record choices across dependency posture, planning threshold, question frequency, and refactor tolerance. Ten Agent Skills under `skills/<name>/SKILL.md` carry routing descriptions, task-specific process, guardrails, and completion evidence. Testing approach is the one skill axis; the other eight skills are independently selectable.

The comment-policy axis is absent. A repository's comment practice belongs in imported rules and learned evidence rather than a global seed choice.

`shadowclone skills` lists both forms without reading or writing the user's profile. `shadowclone init` runs the seed wizard before capture consent when the working directory has no detected rules file. `shadowclone wizard` reruns only those profile choices. Each selected preference or skill becomes an active global declared rule under the stable key `seed:<guidance-id>` after the wizard prints every selected title and receives confirmation. Agent Skill section headings are nested inside that rule rather than becoming separate profile blocks.

An identical rerun produces the same profile. Choosing a sibling retires the prior unedited axis rule. Editing a seed rule transfers ownership to the user, and deleting one records a rejection, so later wizard runs preserve both decisions. Imported, mined, and manual rules remain outside the seed lifecycle.

## Repository guidance import

`shadowclone init` offers to import supported repository guidance before the seed wizard, and `shadowclone import` runs the same synchronization independently. The importer reads root `CLAUDE.md`, root `AGENTS.md`, root `.cursorrules`, and direct skill files under `.claude/skills/` or `.agents/skills/`. Every file is one profile rule. Skill frontmatter is removed, headings are nested beneath the rule title, and fenced code remains intact.

Import is deterministic and calls no engine. A `FileTextRef` reaches `resolveRedacted` before Markdown is transformed or stored. Each rule carries a hashed source locator and hashed aliases for its canonical working directory and, when enabled, remote repository. The state contains no raw source path or remote URL.

An unchanged rerun is byte stable. Source edits revise an unedited rule under the same key. Profile edits remain user-owned, deletions remain rejected, removed sources retire, and renamed sources receive new identities. A Git-identified import lives at `org/<origin>/projects/<safe-name>--<identity-hash>.md`; an import without Git metadata remains under its opaque isolated origin. The compiler admits only the exact project file for the active repository.

## Evidence and learning

Sending 562 MB to a model is not affordable. The work splits by whether it needs a model at all.

**Structural signals cost zero tokens.** They are computed in pure code over the index. Session and origin counts, tool histograms, plan activity, interruptions, permission denials, answered questions, and resolved plans form the mirror. They are evidence about how a person works, not instructions, so this path reports them without writing profile rules.

**Semantic learning costs tokens, over a very small input.** The correction miner reduces the corpus to the moments that carry preference, roughly a thousand to one. Explicit deep learning resolves allowlisted correction moments and the existing profile through the redaction gate, gives them opaque local tokens, and asks the selected authenticated agent CLI to reconcile support, disagreement, narrowing, new guidance, and prior rejections.

`shadowclone learn` updates the local index and prints the structural report. It leaves every profile file unchanged. `shadowclone learn --deep` shows the proposed reconciliation and asks once before writing. `--deep --dry-run` runs the same analysis with an in-memory index and no checkpoint or profile write. `--deep --apply` skips the confirmation. Deep learning remains the only observed-behavior path that can write mined rules, and it requires a second explicit enable in the config.

## Correction mining

The highest value record in a transcript is the moment the user overrode the agent. It is a labeled preference pair, produced for free by someone doing their job, and it is grounded in what they did rather than what they would say about themselves in a settings page.

Six extractors, ordered by yield measured against a real 562 MB corpus of 372 sessions. The counts below are from that machine and are what the implementation should expect to find, not estimates.

**Interruption, 994 found.** The user stopped the agent mid work. Claude Code writes the exact marker `[Request interrupted by user`, so extraction is a string match with no inference. What was running when it was stopped is the signal, and this is the single richest source in the corpus.

**Tool denial, 445 found.** A permission request the user refused, marked by `user doesn't want to proceed with this tool use`. The mirror reports these by tool family, and explicit deep learning may use their redacted context as evidence. One denied Bash command cannot become a blanket Bash rule from the family name alone. Hard enforcement waits for a privacy-safe action fingerprint that can also be computed from live hook input. Claude Code reports `permission_denials` on the terminal `result` message of a headless run, so a clone's own denials need no parsing at all.

**Question answered, 313 found.** An `AskUserQuestion` call paired with the option the user picked. The unchosen options are negative examples, which are rarer and more valuable than positive ones.

**Plan resolution, 570 plan calls found.** An `ExitPlanMode` call and what happened next. Rejection is not written as a marker, unlike the two above, so it has to be inferred from whether the following user turn approves or redirects. Highest value per instance and the most implementation work, so it lands after the three markers above.

**Undo.** An edit that reverts a region an agent wrote in the same session. Expensive to detect and the strongest signal there is, because the user did not just say no, they paid to undo it. Not yet counted.

**Correction prompt, 13 found in 682 prompts.** A user turn opening with no, don't, actually, instead, revert, or wrong. This was expected to be a high yield extractor and it is not: it fires on 1.9 percent of prompts. It ships last, or not at all, and nothing in the design should depend on it.

The structured markers the harness already writes are worth far more than any heuristic over prose. Roughly 1,750 zero-ambiguity correction events exist without a single regex over user text.

The miner runs over the index and emits `Signal` values holding `TextRef` pointers. Text is materialized only inside `src/distill/`, once, redacted, and dropped.

## The mirror

`shadowclone learn` prints measured evidence without changing the profile. A developer has rarely been shown how they actually work with an agent, and the terminal output is where that becomes visible, so its shape is specified here rather than left to whoever writes the CLI.

The block below is the output from the end-to-end fixture used by the learning command test. It specifies the same shape used for a real corpus without publishing a product result from test data.

```
$ shadowclone learn

  Read 1 session, 0.0 MB, 1 active day across 1 origin. No network calls were made.

  Correction moments found
    interruptions ................................... 1
    permission denials .............................. 0
    answered questions .............................. 1
    resolved plans .................................. 0

  You stop the agent most often
    while using Edit ................................ 1

  You have refused tools 0 times
    no tool refusals indexed ........................ 0

  When the agent asked, you answered
    agent questions ................................. 1 of 1
    presented plans ................................. 0 of 0

  Your most used agent tools
    AskUserQuestion ................................. 1
    Edit ............................................ 1

  Deep learning would send
    eligible correction moments ..................... 1 of 2
    reconciliation batch ............................ 1

  Profile unchanged. Run shadowclone learn --deep to reconcile the eligible moments.
```

The report follows five rules.

The first line states corpus and allowed-origin counts and whether an engine call was made. Plain learning always states that no network call was made.

Correction kinds are counted separately before ranked categories, with interruptions first.

Every line carries a count. A count is a claim the user can dispute and an adjective is not.

Nothing in the output is captured text. Category labels are derived and tool names are tool names. Working directories, origin identifiers, source paths, repository names, and excerpts are absent.

The last section previews how many pointer-bearing moments and reconciliation batches explicit deep learning would process. Plain learning then states that the profile stayed unchanged.

The output is judged on one question: does it surprise the person it describes. A profile that could have been written from memory in five minutes is not wrong, it is just not worth running, and it is not worth sharing. The extractors are tuned against that question on the real corpus before anything downstream is built.

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

`source` distinguishes guidance the user declared or wrote from imported and mined guidance. `status` is active, candidate, or stale. Declared, imported, and user-owned guidance stays active during disagreement while `proposal` carries a pending revision or narrowing for the user to decide. Contradicted mined guidance becomes stale, and mined guidance with fewer than three supporting sessions remains a candidate.

Evidence is separated into `for` and `against` identifiers and deduplicated before `supports` and `contradicts` are counted. Current identifiers carry origin, session, timestamp, signal kind, and category. Merged rules union the evidence of their named source rules, and wording changes retain the first constituent's persistent id. Confidence is absent because the previous structural and semantic paths gave the same number two incompatible meanings.

`applies-when` carries explicit conditions for registry and imported guidance. The current compiler preserves the field but does not evaluate task conditions because it does not yet receive task context.

## Compiling to a subagent

The profile compiles two ways. Into a system prompt, which `03-engine.md` covers, and into a Claude Code subagent definition, which is how clones get spawned in parallel inside a session the user already has open.

```
~/.shadowclone/profile/   --compile-->   .claude/agents/<name>.md
```

`src/profile/agent.ts` writes the subagent file: frontmatter with `name`, `description`, `model`, and `tools`, then the compiled profile as the body. Claude Code reads `.claude/agents/*.md` at session start and accepts the same definition as `--agents <json>` on a headless run.

`shadowclone install` performs this compilation for the current repository and registers `.claude/agents/shadowclone.md` in `.git/info/exclude` to prevent personal rules from being committed to shared version control. The plugin also injects the scoped compiled profile through `SessionStart`, and its MCP server exposes the same profile for recall during a live session.

Once it exists, the main session calls `Agent(subagent_type: "<name>")` and gets a copy of the user on a subtask. Ten of those on ten tasks is what the project is named after.

Scope applies at compile time here too. The subagent written into a repo's `.claude/agents/` carries global rules, that remote owner's organization rules, and only the exact matching project file. It receives nothing from another owner or repository.

## Hand edits and lifecycle

The user editing their own profile is the point, so regeneration must never clobber it.

The writer parses the existing file first. A generated block whose visible title or body no longer matches its stored fingerprint becomes active user guidance, leaves generated ownership, and is carried forward verbatim. A generated block removed while the same persistent id is proposed moves to `.rejected` with its last generated text. Later wording revisions under that id remain rejected.

Creation adds an unseen id, revision replaces unedited text under the same id, pinning preserves user text, rejection honors user deletion, and explicit retirement removes obsolete generated text without recording user rejection. Absence from one generation run does not retire a rule. Unedited 0.0.5 template blocks migrate to retired tombstones. Edited legacy blocks become user-owned and keep their text.

Deep reconciliation compares each proposed new rule with a redacted view of these rejection records. A semantic match names an opaque rejection token and is omitted before any new profile key or Markdown block is created.

## Budget and resumption

Deep distillation runs against the user's own subscription quota, which is a real and exhaustible resource. It is designed around that from the start rather than after the first angry issue.

Work is batched by origin and exact repository. Every reconciliation and merge step is checkpointed to `~/.shadowclone/distill/` before the next one starts. A reconciliation checkpoint hashes the complete redacted prompt, output schema, and learner version, so changes to evidence, existing guidance, rejections, or the model contract invalidate stale output. One learning execution owns reconciliation and merge, with a default limit of 20 attempted calls and five minutes. Claude also receives a cumulative $2 ceiling. Codex and Cursor are bounded by calls and time because they cannot enforce a dollar flag. A stopped run keeps completed checkpoints and resumes from unfinished work.

`shadowclone learn --deep` prints the batch count and applicable execution limits before the first model call, then prints a rule-level comparison before any profile write.
