---
name: review-prs
description: >-
  Review a GitHub pull request in the maintainer's voice: verify every claim
  against the pinned head, report findings in chat in a fixed per-issue format
  (Issue, then problematic snippet, then suggested fix), then, only after the
  maintainer approves, stage them as a PENDING draft review with inline
  comments. Use whenever someone says "review PR", "review this PR", "review PR
  #123", pastes a PR URL and asks for a review or for feedback, or asks you to
  draft or stage review comments. Also use when continuing work on a review
  already staged this way (correcting a comment, adding one, checking what is
  pending). Not for fetching CI status and not for merely listing what reviewers
  already said.
---

# Review PRs

Everything you write lands under the maintainer's name, so the standard is theirs: technically
exact, opinionated, and never confidently wrong. A false finding in someone else's voice costs
them credibility with the author and the other reviewers, which is worse than any nit you miss.
Load `clean-code` first if it is not in context, since its no-em-dash and plain-prose rules apply
to everything here.

## Three rules that govern everything

1. **Verify, then write.** Prove every claim against the pinned head commit before it
   goes on the page. Never infer a break from prose or from a diff.
2. **Never publish. Never reply.** You may create a PENDING review and nothing else.
   No `gh pr review`, no `gh pr comment`, no submitting, no approving, no requesting
   changes, no replies to existing threads. The maintainer reads and submits.
3. **Chat first, GitHub second.** Report in the conversation, wait for approval, then
   stage. Do not stage a comment they have not seen.

## Where the bar is highest

Read `references/sensitive-paths.md` whenever a PR touches capture, redaction, storage, or
network egress. On those paths a regression leaks the user's secrets or destroys their learned
history, so a missed finding costs more than a false one, which inverts the bias everywhere else
here. Raise a concern you cannot fully prove and label it honestly, because "I could not rule
this out" is useful there and noise elsewhere.

## 1. Pin the commit

The reviewer is usually looking at a PR that is not checked out, so the working tree may be on
`main` or something unrelated. Pull the PR's real contents.

```bash
gh pr view <number-or-url> --json title,body,author,state,baseRefName,headRefName,headRefOid,baseRefOid,files,additions,deletions
gh pr diff <number-or-url> > "$TMPDIR/pr.diff"
```

Pin the head SHA from `headRefOid` and prove it is reachable. A `git fetch` can fail
quietly and leave `FETCH_HEAD` on an unrelated commit, and the wrong commit produces
a confident worthless review.

```bash
git fetch origin <headRefName>
REF=<headRefOid>                          # from gh, NOT `git rev-parse FETCH_HEAD`
git rev-parse --verify "${REF}^{commit}"  # must print REF, else refetch
```

If `baseRefName` is another feature branch the PR is stacked, and `gh pr diff`
already scopes to it, so do not re-diff against `main` or you will review the
parent's work.

## 2. Read the whole existing conversation before forming a view

This step changes findings, so do it before you write any. In one real session a human
reviewer's comments invalidated the framing of three findings and supplied the evidence that
turned a fourth into the strongest one.

```bash
gh pr view <number> --json reviews,comments
gh api repos/{owner}/{repo}/pulls/<number>/comments --paginate
```

Both calls matter. `gh pr view --json comments` returns issue-level comments only,
so the `pulls/<number>/comments` call is the one that surfaces existing inline
comments. Read those twice, once for the position the maintainer has already taken and once
for how long they write on this repo.

- **Do not re-report what the author already fixed.** Bot threads carry an "Addressed
  in commit <sha>" marker. Check it against the head first.
- **Do not argue with a position the maintainer already staked out** on this PR. If your
  analysis cuts against it, say so in chat and let them decide. Never contradict them
  in their own voice.
- **Build on a human reviewer by name.** "Adding to Sam's point" plus new evidence
  beats restating it.
- **Separate mechanisms that sound alike.** A comment settling one code path does not
  settle a question about a different one with a similar name. Confirm which mechanism
  a comment covers before treating it as closing yours.

## 3. Load the rules being reviewed against

`CLAUDE.md`, the `clean-code` skill, `data-handling` when the PR touches capture or egress, and
any recalled memory already in context. A finding that cites a rule by name is actionable. A
vague style opinion is not.

## 4. Verify, with the traps that have actually burned this workflow

```bash
git grep -n "<symbol>" "$REF" -- '*.ts'
git show "$REF:path/to/file" | sed -n '1,60p'
git diff --name-only "$BASE" "$REF"
```

Kill your biggest "this is broken" hypothesis first. If it survives it leads the
review. If it dies you have saved a false finding. Each trap below has produced a
real false finding, so treat it as a gate the claim must pass before it goes on the
page.

- **"This gets shipped / bundled / sent."** Reachable in the dependency graph is not the
  same as shipped. Read the package's `exports` map and check whether the consuming
  imports are `import type`. A boundary that exists holds even when the graph looks alarming.
- **A build output path is not evidence.** Compiled output goes stale and proves nothing
  about a source dependency. Follow the source `package.json` chain package by package.
- **"Function X does Y."** Open the implementation. A function whose body never constructs
  what you are describing cannot be your example. Use the one the code actually names.
- **Renames and moved exports.** Grep the head for the old name and the old import
  path. A wildcard `"./*"` in `exports` makes a file rename safe; an enumerated map
  does not.
- **Scope of search.** For "removed across N files" or "missing migration, test, or
  handler", audit how you looked. A sweep keyed on one filename silently skips the
  other three spellings, and a missing thing is usually in the head already.
- **"This can be undefined here."** Trace the real call sites.

For a design document the diff is prose, so every claim it makes about the code is a claim to
verify. Read the modules it names, and look for in-repo prior art including sibling documents
under `docs/design/`, because a design that reinvents something the repo already solved is the
most valuable finding you can bring.

## 5. What to evaluate

Trace across file boundaries, since a signature change has consequences two files away.

- Correctness and regressions: logic errors, dropped callers, contract changes,
  edge cases, error handling.
- Privacy and security, which for this project is the same axis: does capture widen without a
  flag, does anything reach the network without passing `redactSecrets`, does a log line carry
  raw capture, does an action that affects someone else run without approval.
- Concurrency and lifecycle: races, reconnection, cleanup on abort, event ordering.
  Watch for an in-process guard credited with cross-process protection.
- Tests: is the new behavior covered, or does the test assert static shape.
- Code quality and the rules from step 3.
- Scope: does the PR do what it claims. Half-finished renames and drive-by churn
  are findings, filed as scope rather than correctness.

## 6. Report in chat, in the fixed format

Open with a one-line **Verdict**: is it safe to merge, and what is the risk.
Then each finding in exactly this shape:

````markdown
## <Short issue title>, `<file path>` (line <n>)
### Problematic code snippet
```<lang>
<the offending code, copied faithfully>
```
### Suggested fix code snippet
```<lang>
<the corrected code>
```
````

Order them correctness and regressions, then privacy, then code quality, then scope and nits. If
there are no functional issues, say so plainly up front. Say how each finding relates to an
existing reviewer comment. Close with a **Bottom line**: what you would block on versus what is
optional. Then state which findings you propose to stage, and stop. Wait for approval.

## 7. On approval, write in their voice and stage a draft

Read `references/voice.md` before writing a single comment. The short version, which does not
replace reading it: **one or two sentences per inline comment and never a wall of text**, a
` ```suggestion ` block wherever the fix is a literal replacement of the anchored lines, assert
the technical fact hard and hedge the recommendation soft, no headers or bullets or bold,
backtick every identifier, and be willing to close by inviting a correction.

Length is the rule that gets broken most, and always on the findings you are proudest of.
Cutting is free: the evidence, the repro, and the reasoning already sit in the chat report from
step 6, which the maintainer reads before choosing what to stage. A comment that makes the
author scroll buries the one line they have to act on.

Then read `references/posting.md` for the exact API call and its gotchas. It is easy to publish
by accident, and pending comments read back differently from published ones.

When a claim turns out to be wrong after staging, say so plainly with the evidence, give the
corrected text, and let them choose between patching, dropping, or rewriting it. Never quietly
patch a comment they have read. If a finding shrinks to a nit under scrutiny, say so and offer
to drop it, because a tighter review reads better than a padded one.
