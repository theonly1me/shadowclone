---
name: research-primary-sources
description: Resolve a technical implementation question against authoritative first-party evidence. Use when behavior depends on a library, platform, protocol, standard, or tool that may have changed.
metadata:
  shadowclone-category: research
  shadowclone-section: workflow
  shadowclone-applies-when: resolving an implementation question that depends on external facts
---
# Research Primary Sources

## Use when

Use this skill when an implementation choice depends on facts outside the repository or on behavior that may differ by version. Primary sources include official documentation, specifications, source code, release notes, and first-party issue trackers.

## Process

1. Write the decision as one answerable question and list the facts needed to settle it.
2. Record the repository's relevant version, runtime, platform, and existing dependency constraints.
3. Search for the owner of each fact. Prefer the specification or implementation that defines the behavior.
4. Open the exact supporting page or source location. Check its version and publication or commit date.
5. Trace important claims back from summaries to their primary source.
6. Compare the evidence with the repository's installed version and current code path.
7. Resolve disagreements by authority and applicability. State when the sources describe different versions or environments.
8. Write the conclusion beside links that directly support each consequential claim.
9. Translate the conclusion into the smallest implementation constraint the code needs.

## Guardrails

- Treat search snippets as leads rather than evidence.
- Prefer current first-party sources for changing APIs and compatibility claims.
- Distinguish a documented guarantee from behavior inferred from source code.
- Mark an inference as an inference and name the observations it connects.
- Quote only the minimum words needed to preserve exact terminology.
- Keep credentials, private URLs, and captured user data out of research notes.

If no authoritative answer exists, state what remains unknown and choose a reversible implementation that contains the uncertainty behind one interface.

## Completion

Research is complete when the decision question has a direct answer or an explicit unknown, every consequential claim has an applicable primary source, version differences are reconciled, and the resulting code constraint is clear enough to implement without repeating the search.
