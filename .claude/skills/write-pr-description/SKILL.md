---
name: write-pr-description
description: Writing or updating the body of a pull request. Use when the user says "write the PR description", "update the description", "fill in the PR body", or pastes a PR body and asks you to finish it. Covers the hard length limits this repo enforces, the one-sentence-per-bullet rule, fetching the live body before editing so the author's own words are never clobbered, and pushing the change without mangling markdown.
---

# Write a PR description

Load the `clean-code` skill first. Its prose rules apply here in full, especially no em-dashes and
no AI tells.

The PR body is the author's document. You are adding to it, not producing your own version of it.

## The limits, which are the point of this skill

An agent writing a PR body will produce three paragraphs where one sentence was needed, and it
will do it in a confident register that reads like effort. That makes review slower, not faster.
A reviewer opens a PR to find out what changed, and every sentence between them and that answer
is a cost.

So the limits below are hard, and they are not style preferences.

| Section | Limit |
| --- | --- |
| Whole body | 250 words |
| What changed | 7 bullets, one sentence each |
| Why | 3 sentences |
| How to verify | commands, plus manual steps if any |
| Data handling | the checklist, or the section is deleted |

Check before you push, and treat a number over the cap as a rewrite rather than a judgment call:

```bash
wc -w < "$TMPDIR/pr-body.md"
```

If you are over, the fix is deleting sentences, not compressing them into denser ones. The
usual thing to delete: an opening paragraph restating the title, a closing paragraph
summarising the bullets, any sentence about what did **not** change, and any narration of how
the work went.

### What a bullet looks like

Good, one sentence, says what the code does now:

```markdown
- Route captured history through `redactSecrets` before it leaves the collector, so a shell history containing an API key no longer reaches the model.
- Rename the loop variable in `getRecentShellHistory` that shadowed the `node:path` import.
- Add `src/collector.test.ts`, covering the redaction wiring and the empty-history case.
```

Bad, and this is the exact failure mode to avoid:

```markdown
- **Enhanced Security Posture**: This PR introduces a comprehensive redaction layer that
  significantly improves the security of the data pipeline. By leveraging a robust set of
  regular expression patterns, we can now confidently ensure that sensitive credentials are
  properly sanitized before egress. This represents a crucial step forward for the project.
```

That bullet is four sentences, has a bold label, uses leverage, robust, comprehensive, and
crucial, and after all of it the reviewer still does not know which function changed. Every
rule below exists to prevent that paragraph.

## Write in the author's voice

These land under the author's name, so match how they write. When unsure, read three of their
recent merged PRs first with `gh pr list --author "@me" --state merged --limit 10`, and skip any
whose body says it was created by an agent, since that wording is not theirs.

- Plain and direct. Short sentences, common words, no hedging and no flourish.
- Technically exact. Backtick every identifier, path and literal, and give real numbers rather
  than "several" or "many".
- Never confidently wrong. If a claim is not proven, label it or leave it out.
- No selling. Do not call a change clean, robust, or comprehensive.

### Calibration a maintainer applied to a body written for them

These are the edits that came back on a draft, and they are the ones worth copying:

- **No metaphor or figurative framing.** "Redaction is the one piece of the pipeline on the
  wrong side of the line" became "Redaction is the one step the collector is missing". Say the
  gap literally.
- **One idea per sentence, then stop.** A trailing "and keeping it here means the set of
  secrets we scrub is tracked twice" got deleted. The first clause already carried it, so the
  consequence clause was padding.
- **Frame it from the side that is missing something**, not from the side that is wrong. "the
  collector is missing" rather than "the distiller holds it wrongly".
- **Name the concrete module instead of an abstract adjective.** "a scoped registry" became "a
  `redactionRules` table".
- **Symbols sit inline, not in parentheses.** "the gate the collector maintains
  (`redactSecrets`)" became "the gate `redactSecrets` maintains".
- **"i.e." rather than a colon** to introduce an enumeration mid-sentence.

## Fetch the live body before you touch it

Always start here, even when the user pasted the body into chat:

```bash
gh pr view <number> --json body --jq '.body' > "$TMPDIR/pr-body.md"
```

The pasted copy is a snapshot. The author may have edited since, and a bot may have appended to
it. Composing from the paste and pushing that back silently deletes whatever landed in between.
`gh` sometimes needs the sandbox disabled, because the GitHub API can fail with a TLS certificate
error inside it.

Read the fetched file, then edit that file. Do not retype the parts you are keeping.

## Preserve what the author wrote

- Every word they wrote stays, in their wording. If a sentence of theirs is wrong, say so in chat
  and let them decide. Do not quietly rewrite it.
- Fill in the sections they left empty. Do not reorganize sections they already filled.
- Their checkboxes keep their checked state.
- A body documenting an approach no longer on the branch is replaced, not preserved. Say so in
  chat first, and keep any checkbox state that still reflects real intent.

## Structure

`.github/pull_request_template.md` is the source of truth and it has four sections. Follow it.

- **What changed.** One-sentence bullets, present tense, saying what the code does now rather
  than the story of getting there. Join the change to its consequence with "so" when the reason
  is not obvious from the name. Give a structural move its own bullet and mark it
  behaviour-preserving: "Move `redactSecrets` into its own file, with no change to what it does."
  Make test coverage a bullet, naming what it covers rather than that it exists.
- **Why.** Three sentences. The observed symptom and its evidence, then the mechanism. Say
  plainly what is not established rather than smoothing over it. Never state the mechanism twice
  at different levels of detail, and never narrate the investigation.
- **How to verify.** The gate commands, then any manual step. Real commands that were run, not
  ones that ought to work.
- **Data handling.** Delete the whole section when the PR touches no capture, storage, or
  egress. When it does, tick every line honestly. An unticked box is a question for the
  reviewer, which is a fine thing to submit.

Never write "none", "n/a", or "-" in a section. Delete the section instead.

## Never leave an HTML comment

The template is full of them as guidance. Replace each placeholder with real content or delete
the section. Check before you push:

```bash
grep -c '<!--' "$TMPDIR/pr-body.md"
```

Expect `0`.

## Push through a file, not an argument

```bash
gh pr edit <number> --body-file "$TMPDIR/pr-body.md"
```

Passing the body as a shell argument mangles backticks, dollar signs, and newlines. A file does
not.

## Verify

Re-fetch the body and confirm the sections the author wrote are still there and still say what
they said. A diff of before and after is the fastest check that you added rather than replaced.
