# <Title>

Every heading below appears in the finished document. A heading that does not apply gets the word "None" written under it and is never deleted, so a reviewer can still argue with the absence.

The register is declarative: state what we are doing, do not offer an opinion on it. No "I think", no "I" at all, no contributor names. Uncertainty belongs in Open Questions and nowhere else. One paragraph per line, no hard wrapping, since hard-wrapped prose is painful to edit. Delete this paragraph and the one above it.

## Summary

One paragraph. What we are doing and why, in the register a reader can act on. No preamble and no restatement of the title.

## Problem

The failure mode, stated before any fix. What breaks today, for whom, and what evidence says so. Numbers where there are numbers, and where they were measured.

## Prerequisites

Each one on its own line, saying what breaks without it. "None" if there are none.

## Design

The approach. Code blocks carry schemas, interfaces and diffs. Prose refers to modules and symbols by name. Every symbol, path and flag named here should have been opened first.

## Files

| Path | Change |
| --- | --- |
| `src/example.ts` | What happens to it |

## Data handling

What this reads, what it stores, and what leaves the machine. Name where the redaction gate sits relative to every new egress path. "None" if the change touches no capture, storage, or network call. Read `.claude/skills/data-handling/SKILL.md` before filling this in.

## Alternatives

One bold lead-in per alternative, then why we are not doing it. Commit to the rejection. "Cheapest to start, and wrong" beats "I don't think we should".

## Accepted costs

The known downsides, named and accepted. A design with a downside the document hides reads as a design that missed it.

## Testing

How this gets verified, including the mutation step that proves a new test catches the bug it claims to catch.

## Open questions

Real questions only, each with what the answer changes. A question nobody needs answered is not open, it is decided. This is the only section where uncertainty belongs.

## Decision record

One line per decision, what was decided and why. No repetition of Alternatives.
