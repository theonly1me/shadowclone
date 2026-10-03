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

An implementation decision depends on external facts or behavior that varies by version.

## Process

1. State the decision as an answerable question. Record the project's relevant version, runtime, platform, and constraints.
2. Find the specification, official documentation, implementation, release note, or first-party issue that defines the behavior.
3. Open the exact source and check its version and date. Trace consequential claims back from summaries.
4. Compare the evidence with the installed version and code path. Explain disagreements caused by different environments or versions.
5. Give the conclusion with direct supporting links and the implementation constraint it creates.

## Guardrails

Search snippets are leads; read the underlying source. Distinguish documented guarantees from inferences and identify the observations supporting an inference.

Quote sparingly and keep credentials, private URLs, and captured user data out of research notes. If authoritative evidence is unavailable, state the unknown and contain it behind a reversible implementation choice.

## Completion

The question has a supported answer or an explicit unknown, and the resulting constraint is clear enough to implement.

Report the answer or the explicit unknown, each claim with its primary source (a link, or a file path and line), and the constraint it puts on the change. Keep the reply to these facts. When a pull request exists, put full command output in its verification section instead of the reply.
