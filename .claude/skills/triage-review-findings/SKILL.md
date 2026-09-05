---
name: triage-review-findings
description: Deciding which findings from an automated reviewer are real before acting on any of them. Use when the user says "check the bot comments", "evaluate the review", "which of these are real", "some of these are noise", or points you at a batch of automated review comments on a PR. Covers reading the comments without flooding context, verifying each claim against the branch head, and separating real bugs from noise and from suggestions that would make things worse.
---

# Triage review findings

Load the clean-code and scoped-fix skills first. This skill decides *which* findings deserve a
change. scoped-fix governs how to make it.

A bot reviewer produces confident prose at a uniform tone whether it is right or wrong. Treat
every finding as a claim to check, never as a defect to fix.

## Read them without drowning

Comment bodies embed whole analysis chains inside `<details>` blocks, often many times longer
than the finding itself. Pulling them raw floods context before you have read a single claim.

```bash
gh pr view <number> --json reviews,comments --jq '...' \
  | perl -0pe 's{<details>.*?</details>}{[analysis omitted]}gs'
```

Inline review comments live at `gh api repos/<owner>/<repo>/pulls/<number>/comments` and carry
`path` and `line`, which is what you need to verify them.

## Verify each claim yourself

**Confirm which ref the work is on first.** The local working tree is often on a different
branch than the PR. Verify against the PR's head, not the working tree and not your memory of
the diff you wrote.

```bash
git fetch origin <branch> && git show origin/<branch>:path/to/file
```

**Resolution markers are unreliable.** A bot may mark a finding addressed in a commit range
because those commits were in the range it reviewed, not because the code changed. Check the
head. In one review, all three findings carrying an addressed marker were still present.

**Verify the location, not only the claim.** A bot can be right that something is wrong and
wrong about where. One finding pointed at the single line that had been fixed while four
genuinely stale lines sat untouched nearby. Read the surrounding code, not just the cited line.

## Sort into four buckets

- **Real.** It fails on inputs that occur. Hand it to scoped-fix.
- **Pre-existing.** True, but the same shape existed before this change. Say so and leave it.
  Bundling it hides what this change actually did.
- **Harmful if applied.** The diagnosis may even be right while the prescription is not. One
  finding correctly noted a code path continues past an unreachable exit, and its suggested
  early return would have left the user's newest capture unwritten so the next run worked
  against stale content. Always ask what the suggested fix breaks.
- **Noise.** The bot misread the code. Common cause is reasoning about what a call *sounds*
  like it does rather than what it does.

## Never reply on the PR

Do not post to a review thread. Not to a bot, not to a human, not a short note saying what
landed. No `gh api repos/<owner>/<repo>/pulls/comments/<id>/replies`, no `gh pr comment`, no
review submission.

The PR conversation belongs to the author. An agent posting there speaks to the author's
collaborators under the author's name without being asked, and a reply that explains reasoning,
quotes test output, or rules on whether a finding was valid is the author's to write or not
write. Pushing a commit is not permission to narrate it.

Report what changed in chat and stop. The author replies in their own words.

If the author explicitly asks you to respond on a thread, post the commit hash and nothing
else.

    01dbe89

No prose, no summary of the fix, no sample output, no verdict on the finding. The diff says
the rest.

## Report before fixing

Present the classification and wait. The user decides which to take. This is the whole point
of triage, and skipping to fixes throws it away.

Give every decline a reason in one or two sentences. A decline with no reason reads as
dismissal, and the user cannot check your judgment against a verdict with no argument behind
it.

Where a decline rests on a factual claim about behavior, verify that claim rather than
asserting it. `git cat-file` on a symlink returns the link target as text is a testable
statement, and testing it took one command.
