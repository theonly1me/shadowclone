---
name: write-design-doc
description: Write or edit a design document under docs/design/. Use whenever someone says "write the design doc", "write a technical plan", "add this to docs/design", "update the design doc", or asks for a proposal for a piece of work. Covers the register a design doc is written in (declarative, never hedged, never first person), the one-paragraph-per-line formatting, the template headings that must all be present, and the content rules that make a doc implementable by someone who was not in the conversation. Not for PR review comments (review-prs) or PR descriptions (write-pr-description), which use a different register.
---

# Write a design doc

Load the `clean-code` skill first. Its prose rules apply here in full.

**Read this before the first sentence.** The `review-prs` skill has a `references/voice.md`, and
its core rule is "assert the fact hard, hedge the recommendation soft". That rule is correct and
it does not apply here. A PR comment offers a judgment to another engineer, so "I think we
should" is right. A design doc states decisions, so "I think we should" is wrong in every
instance. Same author, different register. Applying the PR voice to a design doc is the specific
mistake this skill exists to prevent, and it is easy to make because the two documents get
written by the same person about the same work.

## Where it goes

`docs/design/<kebab-slug>.md`. One file. It holds everything someone needs to implement the work
end to end without having been in the conversation.

## Structure

`docs/design/template.md` is the source of truth. Every heading in it appears in the document. A
heading that does not apply gets the word "None" written under it and is never deleted, so it
stays available for a reviewer to argue with.

Code blocks carry schemas, interfaces and diffs. Narrative goes in paragraphs. Tables carry file
lists and per-item mappings, which is where the file paths live, and prose refers to modules and
symbols by name.

## Register

Declarative. The document states what we are doing and why.

- No "I think", "I believe", "I feel that", "I'd say", "I'd even say", "I'd expect", "I'd keep".
  Cut the hedge and the sentence is already right.
- No "I" at all. Use "we", or drop the subject. "I verified against a real history file" becomes
  "Verified against a real history file".
- No contributor names. Reference the system, the module or the change, never the person who
  shipped it. "Sam added the retention window" becomes "The vault applies a retention window".
- Contractions are fine and normal. "isn't", "doesn't", "can't", "there's".
- Comma splices are fine. "So," and "But," open sentences.
- Every identifier, package, flag, path, route and literal in backticks.
- No em-dashes. No semicolons in prose. No rule-of-three lists, no "not just X but Y", none of
  leverage, robust, seamless, crucial, holistic.

## Formatting

**One paragraph per line. No hard wrapping.** Let the editor soft-wrap. Prose lines run 300 to
770 characters and hard-wrapped prose is a defect, it makes the file painful to edit.

Tables, list items, code blocks, blockquotes and ASCII diagrams keep their own line structure. A
list item is one line however long it runs.

Prettier's default `proseWrap` is `preserve`, so it will not rewrap.

## Content

A design doc is judged on whether someone else can build from it, so:

- **State a measured number, not an adjective.** "140-190 ms of process startup, 590-720 ms for a
  full round trip" beats "some overhead". Say where it was measured, a laptop and a CI runner are
  different answers.
- **Give the failure mode before the fix.** What breaks, then what we do about it.
- **Name the cost and say it is accepted.** A design with a known downside that the doc hides
  reads as a design that missed it.
- **Verify before writing.** Every symbol, path, flag and route named in the doc should have been
  opened. A wrong file path is worse than no file path, the reader trusts it.
- **Quote existing code verbatim, comments included.** Do not reformat a quotation to satisfy a
  prose rule. If the quoted comment has a semicolon in it, it keeps the semicolon.
- **Prerequisites are their own section** and each one says what breaks without it.
- **Open Questions are real questions**, each with what the answer changes. A question nobody
  needs answered is not open, it is decided.
- **Decision Record is one line per decision**, what was decided and why, no repetition of
  Alternatives.

`references/register.md` has before-and-after sentences from a doc drafted in the wrong register
and corrected. Read it if any sentence feels like it is offering an opinion.
