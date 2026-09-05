> **Keep this short.** One sentence per bullet, three sentences max under Why. The whole body
> should be under 250 words. A body longer than the diff gets sent back to be trimmed. Delete
> this line and every `<!-- -->` comment before you submit.

## What changed

<!-- One sentence per bullet. Max 7 bullets. If a bullet needs two sentences, it is two bullets. -->

-

## Why

<!-- Three sentences maximum. The problem this fixes, not the story of how you fixed it. -->

## How to verify

```bash
bun run typecheck
bun test
```

<!-- Add any manual step a reviewer has to take. Delete the block if the commands above are the whole story. -->

## Data handling

<!--
Delete this entire section if the PR touches no capture, storage, or network egress.
If it does, tick every line. An unticked box is a question for the reviewer, not a failure.
-->

- [ ] Any new capture source has an opt-in flag and a README entry in this PR
- [ ] Everything that reaches the network passes `redactSecrets`
- [ ] No raw capture in a log line, an error message, or a test fixture
- [ ] A test exercises the real entry point, not just the redaction function
