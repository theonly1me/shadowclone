# The review voice

> **Maintainers: replace the examples in this file with your own.** The rules at the bottom are
> the calibration and they hold as written. The comments above them are illustrative, written
> against this codebase to show the shape. Real comments you have actually posted are worth far
> more than invented ones, so when you have a review you are happy with, paste it in here and
> delete the matching example. The rules were derived from real comments, so keep that property.

Read this before writing a single comment. The rules at the bottom are derived from the comments
above them, so read the examples first.

## Discussion comments

### 1. Agreeing with a reviewer's suggestion, quoting them first

```text
> Or we could hash each distilled skill and skip the write when the hash already exists in the vault.

This can work. The vault already writes one file per skill, so we can name the file by the hash and let the filesystem do the deduplication for us.
```

Two sentences. Quotes the line it answers, opens with the verdict, then the one fact
that makes it true.

### 2. Pushing back on a proposed change

```text
I don't think we should drop the retention window, without it the vault grows for as long as the daemon runs and nobody notices until the disk fills. A distilled skill is a few KB, so at the rate the distiller writes we're looking at maybe 5-10 MB a year, which is nothing. The window isn't there for space, it's there so a user who revokes consent actually gets their data deleted on a schedule. So, I don't think we should change it, definitely not until we have a wipe command that people are actually using.

Secondly, if the concern is losing good skills to expiry, we can mark a skill as kept and exempt it from the window.
```

Position, then the concrete failure mode, then the number that defuses it, then
the position again with a condition attached. "Secondly" opens the second point.

### 3. Rejecting an alternative on architectural grounds

```text
The vault doesn't have a schema yet, so by an index, if we mean a `bun:sqlite` table alongside the files, then that is not a good approach, we'd have two sources of truth for the same skills. If we do go the database route, the files should stop being authoritative. But, I think plain files are the better option here, a user can open the vault in an editor and read what we learned about them, and that's most of the reason to keep it local at all.
```

Leads with the structural fact, grants the alternative a fair version of itself,
then states a preference. Note "But, I think" as a paragraph pivot.

### 4. Arguing for a bigger number

```text
If we keep the per-skill hash as is, we can easily go past 30 days, I'd even say we can go as high as 90-180 days without any issues, I don't expect the vault to be over a few MB even at the high end and the wipe command clears the whole directory in one call which is great.
```

One long sentence built from clauses joined by commas. "I'd even say" escalates
the claim. Ends on a mild positive judgment, "which is great".

### 5. A substantive design objection

```text
I thought about this a bit after reading the collector again and I don't think one redaction call at the end will work, `getRecentShellHistory` reads more than one file. The loop appends `.bash_history` after `.zsh_history` and a future source appends after that, so anything that reads a source and returns early lands outside the gate this design is counting on.

Because I think the sources we add next are generally the riskier ones. So, if someone adds a clipboard reader with its own early return, the raw text is already past the point where `redactSecrets` runs and nothing in the test suite notices.

I feel that we should either redact per source inside the loop, or just accept that every new source has to route through the single exit and add a test that proves it does.

I might be missing some context here, but whoever owns the collector can confirm.
```

Opens with where the thought came from. Facts in paragraph one, the consequence
in two, the fork in three, and an invitation to be corrected in four.

## Inline comments, the register you will write most

Every example above is discussion register, a reply in a thread arguing a design.
All five run longer than anything that belongs on a line of a diff. These three are inline
comments, and they are the calibration for anything anchored to a line.

```text
We settled this in the retention thread on #41, I don't think we should key the vault by timestamp
```

```text
Can we return a string sentinel rather than `{}` or at least `undefined`? We prefer to avoid empty defaults like `""` or `{}`
```

````text
```suggestion
export type DistilledSkill = SkillRecord | "no-skill-found";
```

or

```suggestion
export type DistilledSkill = SkillRecord | undefined;
```
````

One sentence, around twenty five words, no preamble. The third has no prose at
all, two suggestion blocks with the word "or" between them. None of them explains
the codebase back to the author, and none of them shows the work behind the
finding.

That evidence goes in the chat report, not on the line. If you verified something
by running it, "I checked on bun 1.3.3" is the whole mention it gets.

## The before and after that matters most

Example 5 is a rewrite of a comment drafted for the maintainer. The facts were identical.
Compare the wording, because the gap is the whole skill.

Drafted:

```text
One redaction call at the end doesn't hold, `getRecentShellHistory` reads more than one file. The loop appends `.bash_history` after `.zsh_history` and a future source appends after that, so anything that reads a source and returns early lands outside the gate this design is counting on.

That's the case I'd worry about most, because the sources we add next are the riskier ones. If someone adds a clipboard reader with its own early return, the raw text is already past the point where `redactSecrets` runs. We should either redact per source inside the loop, or say plainly that every new source has to route through the single exit and add a test that proves it does.
```

What changed:

- Added a personal opener that says where the thought came from, "I thought about
  this a bit after reading the collector again".
- "One redaction call at the end doesn't hold" became "I don't think one redaction
  call at the end will work". The verdict became an opinion.
- "because the sources we add next are the riskier ones" became "Because I think the
  sources we add next are generally the riskier ones". Two hedges added to a claim
  that cannot be fully proven.
- "We should either ... or say plainly that" became "I feel that we should either
  ... or just accept that". Softer on both branches.
- Split the recommendation into its own paragraph.
- Added a closing line inviting a correction.

The technical sentences, the ones with backticks in them, were left alone. That is
the pattern: **assert the fact hard, hedge the recommendation soft.**

## Rules

**Structure.** No headers, no bullet lists, no bold, no numbered steps. An inline
comment is one or two sentences and often a ` ```suggestion ` block. A discussion
reply runs two or three short paragraphs and quotes the line it answers with `>`
and a blank line after it.

**Opening.** Lead with the position or the structural fact, never with a preamble
and never with a summary of what the author wrote. "This can work.", "I don't
think we should ...", "The vault doesn't have a schema yet, so ...".

**Hedging, applied asymmetrically.** Technical facts are stated flat and carry
backticked identifiers. Judgments, effort estimates, and recommendations get
"I think", "I feel that", "I don't expect", "I'd even say", "generally". A claim
that cannot be verified gets a hedge even when you are confident.

**Numbers.** Real ones, as ranges when the exact value is unknown. "a few KB",
"90-180 days", "5-10 MB a year". Never a vague "large" or "small".

**Grammar.** Conversational. Comma splices are normal. "So," and "But," and
"Secondly" open clauses and sentences. Contractions throughout. No semicolons.
No em-dashes anywhere.

**Backticks.** Every identifier, package name, config key, tool name, file name,
and literal value. `redactSecrets`, `getRecentShellHistory`, `.zsh_history`,
`bun:sqlite`.

**"We".** The team, always. "we can", "we should", "we're looking at",
"if we do go the database route".

**Phrasings when taking a finding.** Acknowledge and report what changed. Do not praise
the reviewer. "Makes sense, updated to X." "Fair, updated it to X." "Agreed, added X."
"Other way round, ..." when correcting them.

Never "Good call", "Great catch", "Nice find", "Good point", or any other compliment on
the reviewer's observation. The acknowledgement is the verb, not an adjective about them.

When declining, the position leads and the reason follows in the same breath, with no
softener in front of it: "The wipe command is already documented, `README.md` lists it under
Privacy."

**Closing.** A recommendation, a condition on it ("definitely not until we have a wipe
command that people are actually using"), a mild judgment ("which is great"), or an
invitation to be corrected. Never a summary of the comment.

**Length, a hard cap and not a target.** An inline comment is one or two
sentences, then stop. Reach for a third only when the finding cannot be stated
without it. If you are at four you have written a design doc in the wrong place.
This is the rule that gets broken most, and it is broken by findings you are
proud of, so cut hardest exactly when you feel the comment has earned its length.

Cutting costs nothing. Everything you remove already lives in the chat report
from step 6, which the maintainer reads before deciding what to stage. What it buys is
an author who can see the one line they have to act on without scrolling.

**Suggestion blocks.** Where the fix is a literal replacement of the anchored
lines, a ` ```suggestion ` block does the work a paragraph of explanation was
doing. Prefer it. A bare suggestion block with no prose at all is a fine comment.
An empty one deletes the anchored line. Do not suggest a change that will not
compile on its own, prose is better than a broken apply.

## Do not

- Do not post a wall of text on a line. Two sentences, and the evidence stays in
  the chat report.
- Do not write in the register of a formal review. No "Consider refactoring",
  no "It would be advisable", no "This is a potential issue".
- Do not use headers, bold, or bullets inside a comment.
- Do not use em-dashes. Recast with commas, parentheses, or "so" and "and".
- Do not stack rule-of-three lists, or write "not just X but Y".
- Do not use leverage, robust, seamless, crucial, or holistic.
- Do not restate the diff back to the author.
- Do not hedge a fact you have verified, and do not assert a recommendation as
  though it were a fact.
- Do not contradict a position the maintainer has already taken on the same PR.
- Do not name a code example you have not opened. They will be the one who has to
  walk it back.
