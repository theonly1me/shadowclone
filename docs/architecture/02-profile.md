# Profile

The profile is the product. Everything before it is plumbing and everything after it is execution.

It is a directory of markdown at `~/.shadowclone/profile/`. You can read it, edit it, delete a line you disagree with, commit it to a private repo, or hand it to a teammate. It is not embeddings and it is not a database, because a user who cannot read what was learned about them cannot consent to it.

## Two tiers

Deriving a profile from 562 MB by sending 562 MB to a model is not a design, it is a bill. The work splits by whether it needs a model at all.

**Structural signals cost zero tokens.** They are computed in pure code over the index. Tool histograms, which commands run before work is called done, flag preferences, branch naming, session length and turn counts, time of day, how often plan mode is used, which repos get worked on. This tier alone produces a profile that is recognisably a particular person, and it runs with no network call.

**Semantic signals cost tokens, over a very small input.** The correction miner reduces the corpus to the moments that carry preference, roughly a thousand to one. What reaches a model is a few hundred KB of extracted moments, never a raw transcript.

The ratio is the whole trick. `shadowclone learn` runs tier one and is free. `shadowclone learn --deep` adds tier two and requires a second explicit enable in the config.

## Correction mining

The highest value record in a transcript is the moment the user overrode the agent. It is a labeled preference pair, produced for free by someone doing their job, and it is grounded in what they did rather than what they would say about themselves in a settings page.

Six extractors, ordered by yield measured against a real 562 MB corpus of 372 sessions. The counts below are from that machine and are what the implementation should expect to find, not estimates.

**Interruption, 994 found.** The user stopped the agent mid work. Claude Code writes the exact marker `[Request interrupted by user`, so extraction is a string match with no inference. What was running when it was stopped is the signal, and this is the single richest source in the corpus.

**Tool denial, 445 found.** A permission request the user refused, marked by `user doesn't want to proceed with this tool use`. These name what an agent is not allowed to do unattended and populate `boundaries.md` directly. Claude Code also reports `permission_denials` on the terminal `result` message of a headless run, so a clone's own denials need no parsing at all.

**Question answered, 313 found.** An `AskUserQuestion` call paired with the option the user picked. The unchosen options are negative examples, which are rarer and more valuable than positive ones.

**Plan resolution, 570 plan calls found.** An `ExitPlanMode` call and what happened next. Rejection is not written as a marker, unlike the two above, so it has to be inferred from whether the following user turn approves or redirects. Highest value per instance and the most implementation work, so it lands after the three markers above.

**Undo.** An edit that reverts a region an agent wrote in the same session. Expensive to detect and the strongest signal there is, because the user did not just say no, they paid to undo it. Not yet counted.

**Correction prompt, 13 found in 682 prompts.** A user turn opening with no, don't, actually, instead, revert, or wrong. This was expected to be a high yield extractor and it is not: it fires on 1.9 percent of prompts. It ships last, or not at all, and nothing in the design should depend on it.

The lesson worth keeping: the structured markers the harness already writes are worth far more than any heuristic over prose. Roughly 1,750 zero-ambiguity correction events exist without a single regex over user text.

The miner runs over the index and emits `Signal` values holding `TextRef` pointers. Text is materialized only inside `src/distill/`, once, redacted, and dropped.

## The mirror

`shadowclone learn` prints before it writes, and what it prints is the product. A developer has never been shown how they actually work with an agent, and the terminal output is where that happens, so its shape is specified here rather than left to whoever writes the CLI.

The block below is a specification of shape, not a result. The session count, size, day count, and the three totals are measured on the development corpus. Every line beneath them is invented to show what a line looks like, and nothing has produced those categories or those numbers yet.

```
$ shadowclone learn

  Read 372 sessions, 562 MB, 30 active days.   No network calls were made.

  You stop the agent most often when it
    starts editing before showing a plan .......... 211
    writes comments ............................... 89
    runs a broader command than you would ......... 74

  You have refused these tools 445 times
    Bash(rm *) .................................... 61
    Bash(git push *) .............................. 44

  When it asked, you chose
    the smaller diff .............................. 38 of 41
    plan mode first ............................... 29 of 31

  Profile written to ~/.shadowclone/profile/. Open it. Argue with it.
```

Four rules govern the output. The first line states the source counts and that no network call was made, and it is only printed when that is true, which it always is for `learn` without `--deep`. Sections are ordered by measured yield, interruptions first, so the strongest signal is what the user reads first. Every line carries a count, because a count is a claim the user can dispute and an adjective is not. Nothing in the output is captured text. Category labels are derived, tool names are tool names, and the one exception is the tool pattern in a denial, which is already a pattern rather than a command.

The output is judged on one question: does it surprise the person it describes. A profile that could have been written from memory in five minutes is not wrong, it is just not worth running, and it is not worth sharing. The extractors are tuned against that question on the real corpus before anything downstream is built.

## Files

The layout is scoped by the organization a rule was learned from, because a rule learned in an employer's repo must not be injected into a session on someone else's. `07-enterprise.md` covers the boundary in full and this is the shape it produces.

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
```

| File | Holds |
| --- | --- |
| `identity.md` | Voice and register. How this person writes, from their own prompts. |
| `engineering.md` | Stack, conventions, what good looks like in a diff. |
| `workflow.md` | How they drive an agent. Plan first, scope tight, verify before presenting. |
| `boundaries.md` | What an agent is never allowed to do. Derived from denials. |
| `projects/<repo>.md` | Per repo specifics that do not generalize. |

A rule starts in the organization it was observed in. It moves to `global/` when it has been observed in two or more distinct organizations, because a habit that survives across employers belongs to the person, or when the user promotes it by hand. Compilation for a target repo reads `global/` plus the one matching organization directory and nothing else.

## Provenance

Every rule carries where it came from. A profile without provenance is a horoscope.

```markdown
## Runs typecheck and tests before presenting a diff

Never presents work as finished without running `bun run typecheck && bun test` first, and says which one was run.

<!-- shadowclone: observations=47 confidence=0.94 last-seen=2026-09-04 sessions=3 origins=github.com/acme scope=org -->
```

The trailing metadata is HTML comment syntax so it renders as nothing when the file is read as markdown, and parses reliably when the file is read back. This is the one place in the project where a comment is written, and it is data, not commentary.

Provenance is what makes the profile arguable. A rule claiming 47 observations is a claim the user can check and reject, and rejecting it is how the profile improves. `origins` and `scope` are what the compiler reads to decide whether a rule is allowed into a given session, so they are load bearing rather than informational.

## Compiling to a subagent

The profile compiles two ways. Into a system prompt, which `03-engine.md` covers, and into a Claude Code subagent definition, which is how clones get spawned in parallel inside a session the user already has open.

```
~/.shadowclone/profile/   --compile-->   .claude/agents/<name>.md
```

`src/profile/agent.ts` writes the subagent file: frontmatter carrying `name`, `description`, `model`, and `tools`, then the compiled profile as the body. Claude Code reads `.claude/agents/*.md` at session start and also accepts the same definition as `--agents <json>` on a headless run. Once it exists, the main session can call `Agent(subagent_type: "<name>")` and get a copy of the user on a subtask, and ten of those on ten tasks is what the project is named after.

Origin scoping applies at compile time here too. The subagent written into a repo's `.claude/agents/` carries `global/` rules plus that repo's organization and nothing else, so a subagent file committed to an employer's repo holds no rule learned anywhere but there.

## Hand edits survive

The user editing their own profile is the point, so regeneration must never clobber it.

The writer parses the existing file first. A rule the user edited is marked `pinned` and is carried forward verbatim with its observation count frozen. A rule the user deleted is recorded in `~/.shadowclone/profile/.rejected` and is not proposed again. New rules are appended. Nothing is silently rewritten.

## Budget and resumption

Deep distillation runs against the user's own subscription quota, which is a real and exhaustible resource. It is designed around that from the start rather than after the first angry issue.

Work is batched, and every batch is checkpointed to `~/.shadowclone/distill/` before the next one starts. A rate limit or a closed laptop costs one batch, not the run. The default model is a cheap tier, since extracting a rule from a pre-filtered correction pair does not need a frontier model. Action is where the good model earns its cost.

`shadowclone learn --deep` prints what it is about to spend before it spends it.
