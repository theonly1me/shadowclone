# Documentation for users and contributors

## Problem

The README puts implementation details before setup. Current guides mix skills delivery with obsolete profile instructions. Design records contain session approvals and progress logs, and contributor templates encourage repetitive prose.

## Decision

The README covers installation, Agent builds, everyday use, skill maintenance, how learning works, privacy and enterprise controls, and evaluation results. It should be self-contained for someone using or assessing the project. Clear opening sections matter more than a short total word count. Uncommon command options can use expandable sections. Migration, the full data inventory, architecture, and detailed evaluation methods have linked references.

Explain manual deep learning beside its command, including review, dry runs, and how it differs from background learning. Describe the project as a way to maintain engineering standards across agents and large repositories. The author's account of building it entirely with agents belongs in the README and motivation page, supported by an invitation to inspect the code. Keep that account separate from measured adherence; guardrails do not guarantee perfect compliance.

Source locations and data handling have one reference. Other pages link to it and explain only the details needed for their audience. Historical evaluation results retain their methods and limitations without the surrounding session instructions.

Root AGENTS.md carries shared contributor instructions. CLAUDE.md imports it. Bundled skills keep their identifiers, metadata, and required sections while removing repeated explanations.

Revise the entry points first, reconcile the architecture with the implementation, then condense historical records and skills. Consolidate duplicate usage guides into the README and update their inbound links. User guides show the installed `shadowclone` CLI. Bun commands belong in contributor instructions.

Use the author-provided banner as the README header, with descriptive alternative text. Show the browser editor through real screenshots of the skill tree and skill creation. Inspect the live interface, capture only public-safe content, and place the images beside the relevant workflow. Preserve the current build while exploring; publication and paid model requests are outside screenshot capture.

## Writing guidance

Keep information that helps a reader complete a task or understand a decision. Remove expired setup instructions, session narration, and duplicate explanations. Optional template sections appear only when relevant. Record enduring verification requirements and meaningful experimental results, not incidental test counts or tool output.

## Verification

Check links, headings, command syntax, and capability claims. Exercise the existing skill parser and library tests, run the repository checks, and review the rendered guides. Existing code, release history, and recorded evaluation scores remain unchanged.
