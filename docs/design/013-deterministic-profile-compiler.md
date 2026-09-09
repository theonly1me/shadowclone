# Deterministic Profile Compiler and Reversible Installs

## Summary

`compileProfile` becomes the only profile projection used by repository installs, live hooks, MCP, headless dispatch, both evaluation paths, and the offline cache. It emits deterministic source-labelled guidance under a 16 KiB UTF-8 budget, preserves conditional application text, resolves seed-axis conflicts by authority, reports every in-scope omission, and records repository-local installation artifacts so `uninstall` and `forget --all` can remove them.

## Problem

Profile projection currently has two functions and seven callers split between them, while transfer evaluation renders distilled title and body strings independently. The current projection drops `applies-when` and provenance, has no size ceiling, ranks mined observations ahead of explicit guidance, and cannot explain why an active rule was absent. Two active choices from one seed axis can both reach an agent. `shadowclone install` also writes an automatic delegation skill without an explicit choice and leaves its agent, skill, and Git exclude entries behind after `forget --all`.

## Prerequisites

Design record 006 provides stable rule keys, explicit sources, lifecycle statuses, and `applies-when` metadata. Without those fields the compiler cannot report deterministic decisions.

Design record 008 provides stable `seed:<id>` keys and named axes. Without that registry the compiler cannot identify mutually exclusive declared choices.

Design record 010 provides exact repository profile filenames. Without that identity the directory reader cannot admit one project file through a closed path set.

Design record 012 keeps user-owned guidance active during disagreement and withholds unsupported mined guidance through lifecycle status. The compiler consumes those decisions and does not reinterpret evidence.

## Design

The compiler exposes one result-bearing operation. Every production caller invokes `compileProfile`, including callers that only need an in-memory string. `outputPath` is optional and writes the exact returned Markdown when present.

```ts
type ProfileCompileInput =
  | {
      readonly kind: "directory";
      readonly profileDirectory: string;
      readonly origin: OriginScope;
      readonly targetRepo: string | null;
    }
  | {
      readonly kind: "rules";
      readonly rules: readonly ProfileRule[];
    };

type ProfileCompilation = {
  readonly markdown: string;
  readonly appliedRuleKeys: readonly string[];
  readonly appliedRuleCount: number;
  readonly omissions: readonly ProfileCompilationOmission[];
};
```

Directory input opens only `identity.md`, `engineering.md`, `workflow.md`, and `boundaries.md` under `global/` and the matching organization directory, plus the one exact `projects/<targetRepo>.md` file when a repository identity exists. The compiler does not enumerate another owner or repository. It reads raw blocks for local identity, source, lifecycle, and evidence counts, then pairs them by position with a whole-file `FileTextRef` resolved through `resolveRedacted`. Only the redacted visible title, body, and `applies-when` values enter compiled Markdown.

Rules input exists for transfer evaluation results that have already crossed the learning redaction boundary. It uses the same selection, rendering, conflict, and budget code as filesystem-backed production profiles. This removes the evaluation-only title and body concatenation without creating a second compiler.

The compiler assigns one deterministic priority before conflict and budget selection. User-written, declared, and imported guidance form the user-owned tier and sort ahead of mined guidance. Within a tier, higher observation count sorts first, then persistent key, then visible content. Manual blocks have no persistent key, remain user-owned, and use their content as the final stable tie-breaker.

Seed registry keys map active rules to axes. The first rule in compiler priority wins an axis and every later active sibling is omitted with `axis-conflict`. A user-owned sibling therefore always wins over a mined sibling. Equal-authority conflicts resolve by the stable ordering. Free-form guidance has no axis and remains eligible even when its meaning appears contradictory because semantic disagreement belongs to reconciliation.

Candidate and stale rules are omitted before axis selection with their exact lifecycle status as the reason. Eligible blocks render with a plain source label that distinguishes user-written, declared, imported, and mined guidance. A non-empty `applies-when` list renders as an instruction to apply the block only in that stated context. The compiler does not attempt keyword matching against task text because the stored conditions are natural-language instructions rather than a query language.

The complete UTF-8 output is capped at 16,384 bytes, including the fixed profile preamble, separators, source labels, conditions, and trailing newline. A block is appended only when the complete block fits. A block that does not fit is omitted with `budget`, and later smaller blocks remain eligible. No heading, condition, rule body, code fence, or multi-byte character is sliced. The result reports every applied persistent key, the total applied block count including manual blocks, and each omitted persistent key with `candidate`, `stale`, `axis-conflict`, or `budget`.

`shadowclone install` accepts `--auto-delegate`. The default writes only `.claude/agents/shadowclone.md`. The flag also writes a complete `.claude/skills/shadowclone/SKILL.md` workflow that activates when the user explicitly requests a clone or when the opted-in parent finds a bounded parallel task. Its prompt is a delegation brief containing the objective, relevant context, constraints, validation, and expected result. It never instructs the parent to forward the request verbatim.

Install state lives at `~/.shadowclone/installations.json` with schema version 1. Each record stores the canonical repository directory, the closed set of artifacts written there, and only the exact Git exclude patterns that Shadowclone added. Reinstalling merges prior ownership so an omitted flag does not lose track of an earlier installed delegation skill or exclude entry. The manifest is local and contains no profile text.

`shadowclone uninstall` removes the two known repository-local files for the current repository, removes empty Shadowclone-owned leaf directories, removes only recorded or exact Shadowclone Git exclude lines, and removes the current repository from the manifest. The command invocation authorizes those local deletions. `forget --all` reads the manifest first, removes every recorded install with the same bounded artifact set, then removes `~/.shadowclone/`, including the manifest. Missing artifacts and deleted repositories are idempotent successes.

The compiler result replaces heading counting in dispatch receipts. `profileRulesApplied` uses `appliedRuleCount`, so nested headings inside a projected Agent Skill do not inflate the number.

## Files

| Path | Change |
| --- | --- |
| `src/profile/compiler/types.ts` | Define compiler input, result, omission, and internal block contracts |
| `src/profile/compiler/read.ts` | Read the closed profile scope and pair raw metadata with redacted visible text |
| `src/profile/compiler/select.ts` | Apply lifecycle, authority, deterministic ordering, and seed-axis conflict rules |
| `src/profile/compiler/render.ts` | Render provenance and conditions under the 16 KiB whole-block budget |
| `src/profile/compiler/index.ts` | Own the single compile operation and optional output write |
| `src/profile/inject.ts` | Remove the split compilation implementation |
| `src/profile/index.ts` | Export only the shared compiler contract |
| `src/dispatch/index.ts` | Compile through the shared path and use the returned applied count |
| `src/mcp/server.ts` | Return the shared compiler's Markdown |
| `src/cli/liveHooks.ts` | Inject the shared compiler's Markdown |
| `src/cli/profile.ts` | Refresh the offline profile through the shared compiler |
| `src/eval/run.ts` | Write replay profile input through the shared compiler |
| `src/eval/transfer/profile.ts` | Compile in-memory distilled rules through the production representation |
| `src/profile/agent.ts` | Leave Git exclusion ownership to the install lifecycle |
| `src/cli/delegationSkill.ts` | Render the optional complete delegation workflow |
| `src/cli/installState.ts` | Parse and persist the versioned local installation manifest |
| `src/cli/installArtifacts.ts` | Add and remove the closed artifact and Git exclude sets |
| `src/cli/install.ts` | Compile, write selected artifacts, and record ownership |
| `src/cli/uninstall.ts` | Remove the current or recorded repository installation |
| `src/cli/forget.ts` | Remove recorded repository installs before the Shadowclone home directory |
| `src/paths.ts` | Add the installation manifest path |
| `src/cli/index.ts` | Parse `install --auto-delegate` and `uninstall` |
| `README.md` | Document compiler behavior, optional delegation, uninstall, and complete wipe semantics |
| `CLAUDE.md` | Add the new CLI capability and compiler boundary to repository guidance |
| `docs/architecture/README.md` | Show installation state and uninstall in the system path |
| `docs/architecture/02-profile.md` | Define deterministic compilation, budget, conditions, provenance, and omissions |
| `docs/architecture/05-privacy.md` | Document local install state and the expanded one-step wipe |
| `docs/design/README.md` | Register this design and its implementation status |

## Data handling

Directory compilation reads the same user-owned profile files already read by install, hooks, MCP, dispatch, and eval. Raw text remains local and supplies metadata only. Every title, body, and condition placed in a model-facing profile comes from a whole-file `FileTextRef` resolved through `resolveRedacted`, where `redactSecrets` remains the single egress gate. Rules input is limited to model-returned evaluation guidance already produced from redacted evidence.

The installation manifest stores canonical local repository directories, fixed relative artifact identifiers, and fixed Git exclude patterns under `~/.shadowclone/`. It stores no transcript, profile text, remote URL, repository identity, prompt, model output, or telemetry. Install and uninstall output reports counts and fixed artifact names without printing recorded repository paths.

No new capture source or network call is introduced. `install`, `uninstall`, and `forget --all` are explicit local commands that authorize their documented writes and deletions.

## Alternatives

**Keep `buildCompiledProfile` for in-memory callers.** Two public operations allow representation and selection policy to diverge again. One compiler with an optional output path serves both uses.

**Select rules by matching natural-language conditions against task text.** Substring matching would turn prose into an accidental query language and silently discard relevant guidance. Conditions remain visible instructions for the agent until a typed condition language exists.

**Truncate the final Markdown string at 16 KiB.** Byte slicing can break UTF-8, Markdown structure, and rule meaning. Whole-block admission makes every omission explicit.

**Let observed frequency outrank declared guidance.** A frequently observed mined rule can crowd out an explicit choice under the budget. Authority is selected before evidence count.

**Delete every matching Git exclude line during uninstall.** A matching line may predate Shadowclone. The manifest records which lines the installer added and uninstall limits automatic cleanup to that ownership record.

**Install automatic delegation by default.** Automatic task routing is product policy and cannot be presented as learned behavior. The explicit flag records the user's choice.

## Accepted costs

The compiler loads the package seed registry to resolve axes. This adds a small local file read to compilation and keeps axis identity in one canonical registry.

Natural-language conditions consume part of the 16 KiB budget because an agent needs the context to apply a rule correctly.

An install created before schema version 1 has no manifest record, so `forget --all` cannot discover it. Running `shadowclone install` once records it, while `shadowclone uninstall` can remove the known artifacts from the current repository directly.

Repository directories in the installation manifest reveal local project locations to a person who can already read the user's home directory. They never leave the machine and are required for a one-command cross-repository wipe.

## Validation

`bun run check` passes: typecheck, Biome with its as-cast plugin, the conventions checker, and 326 tests across 96 files, up from 310 with 6 failures at the start of the change.

The redaction gate was proven by replacing the `resolveRedacted` result in `src/profile/compiler/read.ts` with raw file text. The planted-secret assertion failed, and the failure output showed the planted Stripe-shaped key intact in both the rule body and the `Applies when` line. Restoring the gate returned the test to green.

The fixture builds that key from a prefix constant at run time. A literal Stripe-shaped token in a source file trips GitHub push protection, and the test needs the shape rather than the literal.

The transfer-evaluation test was proven by restoring the hand-rolled title and body concatenation in `src/eval/transfer/profile.ts`. The source-label assertion failed. Restoring the compiler call returned it to green.

The dispatch receipt test was proven by restoring heading counting. A rule whose body contains a fenced Markdown sample with two headings reported 3 applied rules instead of 1. Restoring `appliedRuleCount` returned it to green.

The lifecycle walk was run end to end on a scratch home and a scratch repository whose `.git/info/exclude` already contained an unrelated line. Default install wrote the agent alone, `--auto-delegate` added the skill, the manifest recorded both artifacts and both exclude patterns, uninstall removed both files and only the two Shadowclone exclude lines, and `forget --all` after a reinstall removed the repository artifacts and the home directory. The unrelated exclude line survived every step.

## Testing

Compiler tests first fail against the current split implementation by asserting source labels, visible conditions, lifecycle omission reasons, declared-over-mined axis selection, deterministic bytes, UTF-8 byte accounting, whole-block budget omission, redaction of a planted profile secret, and one result shape for directory and in-memory inputs. The redaction test is proven by temporarily replacing its `resolveRedacted` result with raw file text, printing that changed line, observing the planted secret assertion fail, restoring the gate, and observing it pass.

Caller tests cover install, live hooks, MCP, dispatch, offline refresh, replay eval, and transfer eval through `compileProfile`. Transfer evaluation asserts the source-labelled production representation so restoring manual title and body concatenation fails.

Install tests prove the delegation skill is absent by default, present only with `--auto-delegate`, contains a structured brief instead of verbatim forwarding, records only written artifacts, and preserves exact pre-existing Git excludes. Uninstall tests prove current-repository cleanup, idempotency, unrelated `.claude` files remain, and only installer-owned exclude lines are removed. Forget tests create two recorded repositories and prove both installations disappear before the Shadowclone home directory while transcript sources remain untouched.

Focused tests run after each behavior group, followed by `bun run check`, executable build, source and built help comparison, and package dry run. The final data-handling scan accounts for every new console sink, file write, file deletion, and model-facing profile string.

## Open questions

None.

## Implemented behavior

`compileProfile` is the only projection. `buildCompiledProfile` and `src/profile/inject.ts` are gone, and all seven production callers plus both evaluation paths go through the one operation.

Two corrections to this record were made during implementation, both stated rather than applied silently.

The closed path set admits `identity.md`, as designed. No `ProfileSection` writes that file today, so it is admitted and simply absent. `02-profile.md` documents it as part of the layout, so admitting it keeps the two documents in agreement at the cost of one existence check.

The first draft of the privacy test asserted an uppercase `[REDACTED:` marker. `src/redact/replace.ts` emits lowercase `[redacted:<label>]`, and the stripe-key rule keeps its public eight-character prefix, so a planted `sk_live_...` key redacts to `sk_live_...[redacted:stripe-key]`. The assertion was corrected to match the implemented redactor.

Raw and redacted block lists are paired by position. Lifecycle comes from the raw side because `parseCurrent` marks a block edited when its fingerprint does not match, and redacting a secret changes that fingerprint. Reading lifecycle from the redacted side would silently reclassify every secret-bearing rule as hand-written.

`applies-when` is read from the redacted side for the same reason it matters: the mutation proof below showed a planted secret reaching compiled output through the condition line as well as the body.

Uninstall removes the recorded exclude lines for a recorded install. An install predating the manifest has no record, so uninstall falls back to the two exact Shadowclone patterns for the current repository only.

## Decision record

Use `compileProfile` as the only profile projection and return Markdown plus explicit application decisions.

Resolve filesystem profile text through `resolveRedacted` before it enters compiled model guidance.

Render natural-language conditions as agent instructions instead of treating them as an implicit query language.

Rank user-owned guidance ahead of mined guidance and resolve known seed-axis conflicts deterministically.

Cap the complete profile at 16,384 UTF-8 bytes and omit only whole blocks.

Require `--auto-delegate` before installing the delegation workflow.

Track repository-local artifacts in a versioned local manifest and remove them through `uninstall` or `forget --all`.

Pair raw and redacted profile blocks by position, taking lifecycle from the raw side and every model-facing string from the redacted side.

## Documentation impact

`README.md` documents the compiler contract, `--auto-delegate`, `uninstall`, and the expanded wipe. `CLAUDE.md` adds the compiler boundary as a standing rule and the two new CLI capabilities. `docs/architecture/02-profile.md` gains the one-compiler section. `docs/architecture/05-privacy.md` documents the installation manifest and the expanded wipe. `docs/architecture/README.md` shows installation state and uninstall in the loop.

`01-capture.md`, `03-engine.md`, `04-acting.md`, `06-roadmap.md`, and `07-enterprise.md` were checked and remain accurate. No capture source, engine contract, action tier, build order, or organization boundary changed.
