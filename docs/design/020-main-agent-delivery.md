# Delivering guidance to the main agent

This replaced subagent-only delivery. [Live context hooks](017-self-improving-agent-environment.md) later replaced copied profile text, and [skills delivery](023-skills-as-delivery.md) changed the content being delivered.

## Problem

A profile helped only when the user delegated to Shadowclone. Normal work in the main coding agent did not receive the learned preferences.

## Decision

Install scoped guidance through each agent's native instruction mechanism. Use managed sections with ownership fingerprints, preserve surrounding user text, and update only sections Shadowclone still owns. Keep existing hooks when adding the session hooks needed for context delivery and learning.

Resolve context for the actual repository at session start. Personal installation and repository installation are distinct choices. Repository files that may be shared must not silently receive private preferences.

Uninstall removes owned sections and hooks while preserving user changes. A conflicting edit requires review instead of overwrite or deletion.

## Tradeoffs and verification

Native instruction discovery differs by provider, so installing a file does not prove the agent read it. Verify paths, hook payloads, scope selection, repeated installation, and removal independently. Live delivery probes must use isolated synthetic instructions and distinguish complete delivery from a partial tool preview.
