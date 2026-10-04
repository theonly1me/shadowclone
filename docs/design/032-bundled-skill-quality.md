# Bundled skills that earn trust on every host

## Problem

Agents need guardrails that hold on every host, not notes in one agent's private memory. The bundled skills do not provide them yet.

A recent fix shows the gap. `shadowclone init` met a symbolic link at `~/.codex/AGENTS.md`, a file shared with other agents. The first fix skipped that agent by default, printed the skip in the middle of the output, and still counted the agent as installed. A second change had to make the skip visible. No bundled skill asked the agent to compare block, skip, and ask by their consequence, or to read the real output before calling the work done.

The 11 bundled skills have these weaknesses:

- Each has 33 to 44 lines and no worked example.
- Descriptions use abstract nouns ("ready for handoff", "proportional coverage") instead of words a user says. Routing reads only the description.
- No skill makes the agent run the user's command and check the real output: counts, final lines, and exit code.
- Several rules accept low-value work. Rerunning unit tests satisfies verification, and a helper test satisfies regression proof while the CLI symptom stays untested.
- `prove-regression-tests`, `testing-first`, and `testing-risk-based` overlap. The last two are exclusive choices on one axis.

The product also blocks better skills:

- Publication rejects a bundled skill that references `scripts/`, `references/`, or `assets/` (`src/builds/publication.ts`).
- The catalog republishes the installed copy of an equipped skill (`src/builds/catalog.ts`), so a rewritten bundled skill never reaches existing installs.
- The package root is found by checking for `skills/testing-first/SKILL.md` (`src/skills/library.ts`), so retiring that skill breaks every command.
- Routing lists one full description per skill against a 4,096-byte budget, and the bundled set already uses about 3.2 KiB.
- A Codex repository install writes `AGENTS.override.md`. Codex reads at most one instruction file per folder, so this can hide a team's `AGENTS.md`.

## Decision

### One quality bar

A lint in `src/skills/quality.ts` runs with `bun run lint` and checks every bundled skill:

- Frontmatter has only `name`, `description`, and `metadata`, the fields that every host and the Agent Skills format accept.
- The description has 250 to 900 characters. It starts with "Use when" or "Use before", quotes at least two phrases a user says, states the outcome, and ends with "Not for ... (use `<skill>`)" naming another bundled skill.
- `shadowclone-applies-when` is a moment phrase of 90 characters or fewer that starts with before, when, after, or while.
- The body has at most 150 lines, so the whole skill survives context compaction. Its sections, in order:
  1. Use when.
  2. Gates: 3 to 6 numbered rules, each with a yes-or-no outcome, inside the first 40 lines.
  3. Process.
  4. Example: Situation, Easy route, Hidden cost, Best route, and Evidence.
  5. Guardrails.
  6. Completion: at most 6 items. Each item is a command, an exit code, an output line, or a `file:line`.
- The text has no tool names that only one host has, and no em or en dash. It passes the plain-English checker and the privacy check.
- No sentence appears in more than two skills, except the shared voice block.
- Every referenced file exists one folder down. Every script is a dependency-free Node ESM file with its own test.

A temporary list names the skills not yet rewritten. The rules land first, and the list empties as each skill is rewritten.

### Catalog

| Skill                                                                                                                                 | Change                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests-that-catch-bugs`                                                                                                               | New. Replaces `prove-regression-tests`, `testing-first`, and `testing-risk-based`. Test-first becomes an ordering option inside it, and the `testing-approach` axis goes away.                                                                                                                                                                            |
| `choose-by-consequence`                                                                                                               | New. Compares a shortcut with the alternatives by its consequence for the user.                                                                                                                                                                                                                                                                           |
| `verify-and-review`                                                                                                                   | Rewritten around the real outcome on the surface the user uses.                                                                                                                                                                                                                                                                                           |
| `write-plain-english`                                                                                                                 | New. Simplified Technical English rules based on ASD-STE100, the dash rule, a checker script, and the voice block.                                                                                                                                                                                                                                        |
| `plan-with-review-page`                                                                                                               | New. Read-only planning, one round of decisions with recommendations, and a self-contained HTML review page.                                                                                                                                                                                                                                              |
| `verify-review-findings`                                                                                                              | New. Verifies each review finding at the pull request head before any change.                                                                                                                                                                                                                                                                             |
| `scope-confirmed-changes`                                                                                                             | Rewritten. Reproduces the issue before any fix, with a test, a real command, or the real interface. After the fix, the same reproduction must pass. Reasoning from data and code is a labelled last resort when reproduction is impossible. Keeps the change to confirmed, reachable behavior, never turns a passing check red, and adds the voice block. |
| `diagnose-before-editing`, `design-deep-modules`, `research-primary-sources`, `resolve-conflicts-by-intent`, `typescript-type-safety` | Raised to the bar. Type safety prefers type guards and schemas over assertions.                                                                                                                                                                                                                                                                           |
| `shadowclone-work`                                                                                                                    | Description order and voice block only. Its measured text stays, and the lint does not require an Example section in it.                                                                                                                                                                                                                                  |

The new names differ from common personal skill names, so a user's own `planning` or `scoped-fix` skill never blocks publication.

### Decision policy

`choose-by-consequence` carries one policy. A risky behavior choice is any block, skip, warning, retry, default, or fallback that touches user-owned or shared files, data, security, or public behavior such as CLI output and exit codes.

- While planning, the agent raises each risky choice as an open decision with options, with the option that fails loudly first.
- While executing, the agent acts without asking and picks the option that fails loudly. A skip counts as loud only when the summary counts it, the final output names it, and the exit status shows it.
- The agent never writes through a file it does not own, such as the target of a symbolic link.
- The handoff lists each choice with the real output line that shows it.

The routing header repeats one sentence of this policy for every host: show each skipped or degraded step in the final output and the handoff.

### Voice

Skills that write pull requests, commit messages, comments, or documents for the user share one voice block. The agent reads `~/.agents/voice.md` before writing. If the file is missing, the agent builds it once from the user's own merged pull requests, review comments, and commit messages, keeps only text the user wrote, and states the sources in its handoff. The agent never overwrites an existing or linked `voice.md`. Every host can read this path, and Shadowclone writes only under `~/.agents/skills/<name>/`.

### Delivery

- Bundled skills publish their supporting files, and retirement removes them.
- `shadowclone sync` replaces installed copies whose fingerprint matches the published text, and prints one line per replaced copy. A copy the user edited stays untouched and is listed for review.
- `src/builds/retired.ts` maps the three retired testing ids to `tests-that-catch-bugs`. Sync selects the new skill wherever a retired one was selected, and prints one line per change. An edited retired copy stays as the user's own skill. Users who chose `testing-first` also see a `shadowclone remember` hint, and nothing creates a rule for them.
- The package-root check stops depending on any one skill.
- Routing lines become `- <moment>: <skill>`, built from `shadowclone-applies-when`. With all 13 skills, routing uses about 1.6 KiB. Each host still lists the full descriptions through its own skill catalog.
- A delivery-matrix test installs every integration in a synthetic home. It checks that each host's skill folders hold byte-identical skills and that every host receives the same routing text. Known gaps are rows in the test's table, so closing a gap changes a reviewed row.
- A Codex repository install stops before it writes an `AGENTS.override.md` next to a team `AGENTS.md`, and names both files.

### Checks that replace rules

- The skill lint.
- `scripts/privacy.ts` scans `skills/`, `preferences/`, and `plugins/shadowclone/skills/`. It flags email addresses, home paths that are not synthetic, `owner/repo#N` references, URLs not on an allowlist, gendered pronouns where a skill should say "the user", and private terms stored as SHA-256 hashes so the plain names never enter the repository.
- `scripts/conventions.ts` rejects the en dash as well as the em dash, and also checks `.mjs` and `.html` files.
- `skills/write-plain-english/scripts/check-ste.mjs` reports dashes and sentences over 25 words as errors, and passive voice, phrasal verbs, and vague words as warnings.
- The review page validator, the routing budget test, the migration tests, the `voice.md` write guard, and the delivery matrix.

### Sequence

Each step is one pull request: this record, the dash rule, the skill lint, the privacy check, the delivery matrix, supporting files, sync updates, the migration, routing, the six new or rewritten skills, the remaining skills, and the Codex override block.

## Consequences

No evaluation gates these skills. The owner tests them in use. Each skill lands in its own pull request, so one that triggers or behaves worse reverts alone. The routing header has its own pull request for the same reason; earlier measurements showed routing text moving preference adherence by -7.9 to +2.3 points.

Sync now changes skill files on users' machines. It changes only copies whose fingerprint still matches the published text, and it reports each change.

The ideas behind several gates come from the public, MIT-licensed skill collections `mattpocock/skills`, `poteto/noodle`, and the pstack plugin in `cursor/plugins`. The text in this repository is original.

Three delivery gaps stay open for a later change: private builds reach no host, the Antigravity CLI global skill folder receives nothing, and Cursor reads both `~/.agents/skills` and `~/.claude/skills`, so each global skill reaches it twice. Cursor's documentation does not say how it treats two skills with the same name.

## Verification

- `bun run check` passes, including the skill lint, the privacy check, and the conventions check.
- `bun test src/integrations/deliveryMatrix.test.ts` shows every host receiving the same skills and routing text.
- The plain-English checker reports no errors on every bundled skill, under both `node` and `bun`.
- In a synthetic home with an old build that selected `testing-first`, `shadowclone sync` prints one line per update and swap, lists edited copies, reports true counts, and exits 0.
