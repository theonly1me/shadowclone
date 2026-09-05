# The design doc register, before and after

Every pair below shows the same facts written twice. The left is a draft written after loading
`review-prs/references/voice.md` and applying it wholesale. The right is what it had to become.
The facts are identical in every pair, only the register changed.

Read the pairs before the rules. The rules are derived from them.

## Hedged recommendation becomes a decision

> I think redacting at the collector boundary is the one worth keeping, it's the single exit
> every source already passes through.

becomes

> Redacting at the collector boundary is the approach we want to keep, it's the single exit every
> source already passes through.

The hedge was the only thing removed. The author knows which approach we are keeping, that is why
they are writing the document.

## Rejecting an alternative

> **Redact inside the distiller instead.** Cheapest to start. I don't think we should, the
> distiller isn't the only thing that will ever send data.

becomes

> **Redact inside the distiller instead.** Cheapest to start, and wrong. The distiller isn't the
> only thing that will ever send data.

"and wrong" does the work "I don't think we should" was doing, in three words, and it commits.

## First person on a verified fact

> I verified the whole loop against a real history file while writing this. Seeded a fake key,
> ran the collector, confirmed the key never reached the model.

becomes

> Verified against a real history file: seeded a fake key, ran the collector, confirmed the key
> never reached the model.

Who verified it does not matter to the reader. That it is verified does.

## First person on a measurement

> I measured this on a laptop. Reading 100 lines of `.zsh_history` is 2-4 ms. Running all eight
> redaction patterns over it adds about 1 ms, so I'd expect the whole capture step to stay under
> 10 ms.

becomes

> Measured on a laptop, reading 100 lines of `.zsh_history` is 2-4 ms. Running all eight
> redaction patterns over it adds about 1 ms, so expect the whole capture step to stay under 10
> ms.

Note that "on a laptop" survives. Where a number was measured is part of the number.

## A judgment about a contract

> `redactSecrets` deliberately over-redacts rather than trying to be precise, and I think that
> decision should stand, it's a good one for a gate whose failure mode is a leaked credential.

becomes

> `redactSecrets` deliberately over-redacts rather than trying to be precise, and that decision
> stands, it's the right one for a gate whose failure mode is a leaked credential.

"should stand" to "stands", "a good one" to "the right one". A document that says a decision
should stand invites the reader to relitigate it.

## Naming a contributor

> Sam added the retention window to the vault and it solves the same problem a different way.

becomes

> The vault applies a retention window, which solves the same problem a different way.

Design docs describe systems. Who wrote a system is not a property of it, and it dates the
document.

## An accepted cost

> Over-redacting means the model sometimes loses the context that made a command interesting, and
> I think that's fine, but it does cost us some distilled skills.

becomes

> Over-redacting means the model sometimes loses the context that made a command interesting, and
> that's fine, but it does cost us some distilled skills.

The cost still gets named. Only the hedge in front of the acceptance goes.

## Where hedging is still correct

Nowhere in the body. The place uncertainty belongs is Open Questions, stated as a question with
what the answer changes:

> How much context does over-redaction actually cost the distiller? That decides whether we need
> per-pattern tuning or whether the current blunt rules are the end state.

That is not a hedge, it is an unresolved input, and separating the two is the whole point. A
document that hedges its body reads as unsure about decisions it has already made, and then the
genuinely open questions do not stand out.

## The one-line test

Read any sentence in the body and ask whether it is offering an opinion or stating what we are
doing. If it is offering an opinion, either it is a decision and should be stated, or it is an
open question and belongs in that section.
