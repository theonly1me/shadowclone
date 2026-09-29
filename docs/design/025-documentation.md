# Documentation for users and contributors

## Problem

The README puts implementation details before setup. Current guides mix skills delivery with obsolete profile instructions. Design records contain session approvals and progress logs, and contributor templates encourage repetitive prose.

## Decision

The README covers installation, Agent builds, everyday use, skill maintenance, how learning works, privacy and enterprise controls, and evaluation results. It should be self-contained for someone using or assessing the project. Clear opening sections matter more than a short total word count. Uncommon command options can use expandable sections. Migration, the full data inventory, architecture, and detailed evaluation methods have linked references.

Explain manual deep learning beside its command, including review, dry runs, and how it differs from background learning. Describe the project as a way to maintain engineering standards across agents and large repositories.

Source locations and data handling have one reference. Other pages link to it and explain only the details needed for their audience. Evaluation results keep their methods and limitations without the surrounding session instructions.

Root AGENTS.md carries shared contributor instructions. CLAUDE.md imports it. Bundled skills keep their identifiers, metadata, and required sections while removing repeated explanations.

Revise the entry points first, reconcile the architecture with the implementation, then condense historical records and skills. Consolidate duplicate usage guides into the README and update their inbound links. User guides show the installed `shadowclone` CLI. Bun commands belong in contributor instructions.

Use the author-provided banner as the README header, with descriptive alternative text. Show the browser editor through real screenshots of the skill tree and skill creation. Inspect the live interface, capture only public-safe content, and place the images beside the relevant workflow. Preserve the current build while exploring; publication and paid model requests are outside screenshot capture.

## README as a quick start

**Problem.** The self-contained README grew to about 200 lines of reference material. A new reader met Agent builds, learning, skill maintenance, repository setup, and internals before finding how fast setup is. The results table used counts and multiples that did not tell a reader whether Shadowclone helps.

**Decision.** This replaces the earlier decision that the README is self-contained. The README leads with three commands and their time cost, then plain-language results, then a privacy summary, then links to guides. `shadowclone wizard` alone is the shortest path and needs no learning. `learn --deep` runs stop after about five minutes or 20 model calls, so the README says to run it again when history remains. A short block tells coding agents the exact commands and that `init` needs the user.

**Guides.** Usage detail moves to `docs/guides/`: agent builds, learning, skills, repositories, how it works, and commands. The README keeps a short privacy summary and links to the data-handling and enterprise references. Text moves without loss, long paragraphs are split, and relative links are corrected. The documentation index and `AGENTS.md` link to the guides instead of README anchors.

**Results.** The README shows the share of preferences followed with and without Shadowclone, the gain in points, and what changes in practice. It states where the gain is statistically clear and where it is not. `evals.md` holds the method and detailed tables.

**Verification.** Check every relative link, every command against `shadowclone --help`, and paragraph length. Public evaluation material contains no evaluator identity, billing detail, private installation, path, or repository name.

## Writing guidance

Keep information that helps a reader complete a task or understand a decision. Remove expired setup instructions, session narration, and duplicate explanations. Optional template sections appear only when relevant. Record enduring verification requirements and meaningful experimental results, not incidental test counts or tool output.

## Verification

Check links, headings, command syntax, and capability claims. Exercise the existing skill parser and library tests, run the repository checks, and review the rendered guides. Existing code and release history remain unchanged.
