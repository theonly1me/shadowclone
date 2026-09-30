# From a correction to active guidance

## Problem

A user can consent to learning, correct an agent, and still begin the next session without that correction in usable guidance. Indexed events from a newly disabled source can reach learning. Codex user text can be indexed without becoming a learning excerpt. A declined manual proposal is marked processed without a pending decision. Historical sessions often have no verified repository identity, so repository guidance remains deferred. Native routing can point Claude at a skill path it cannot read, repeat the same text through hooks, and place personal absolute paths in repository files.

The preference study has separate reporting defects. Unknown checks lower headline rates while disappearing from detailed counts. Bootstrap samples checks instead of complete sessions. The README omits the existing-skills arm that is present in the scored environments. These defects and the narrow study must be resolved before stronger outcome claims.

The intended user result is one visible sequence: identify a reusable correction, review its evidence and scope, approve the exact guidance change, see where it became active, and undo or revise it later. Publication, observed loading, and demonstrated behavior are separate facts.

## Decision

### Delivery contract

The active environment owns one versioned preference record, its evidence and source provenance, its review decision, and the artifacts produced from it. The environment remains the only active write path. A short scoped preference is rendered directly into the matching Claude Code and Codex native instruction surface. A skill holds the complete rule or procedure and is selected by name and description when the task needs its detail. The native text does not require an unconditional file read or contain an absolute personal path. Existing skills remain the baseline. Bundled workflows are individually optional.

Each publication revision contains skill or resource changes, native text, environment delivery decisions, and destination fingerprints. Review decisions are recorded first so a later model or publication failure leaves a durable retryable decision. A successful approval attempts scoped publication and refreshes installed integrations in the same operation. If a destination changed since preview, publication stops with an actionable pending reason and preserves the prior files. History retains the decision and subsequent publication revisions independently for undo. The result reports active scopes and whether a new agent session is required. A declined confirmation stores a pending proposal. An explicit rejection stores a rejection so later learning does not silently recreate the rule.

Global rules go only to global native instructions. Repository rules go only to a registered matching repository and its private local instruction files. Shared repository instructions require an explicit shared build preview and use relative references. Personal repository publication must not create untracked `AGENTS.md` or `CLAUDE.md` containing home paths. The native adapter for each agent owns the destination and formatting; the environment owns rule selection and precedence. Hooks retain capture and session metadata duties and do not repeat native guidance already loaded from files. Hook commands resolve to the installed executable at integration time and are refreshed by synchronization.

### Consent and evidence

Create one eligible-event selector used by manual, setup, and background learning. It filters indexed events against the current effective source configuration and managed policy before signal derivation. The model-facing materialization path rechecks authorization before resolving each reference. The index can retain old pointers, but a disabled source supplies no new learning text. Existing published guidance remains until the user selects a separate reviewed source-removal operation, as documented in the current data policy.

Normalize provider records to typed user-text references before prompt extraction. The Codex normalizer reads `response_item.payload.content` blocks of type `input_text`; Claude retains its supported user content forms. Both reject tool returns, tool-returned file data, thinking, and data-access results. Materialization still goes through `resolveRedacted`; normalized records hold pointers rather than another raw transcript archive. Contract tests must follow the same adapter, index, selection, redaction, reconciliation, and publication path used by the CLI.

Historical repository binding is a user decision. With Git-metadata consent, show candidate historical working-directory groups alongside their current verified remote identity and ask for an explicit mapping. Record the confirmed binding and its provenance in the index. An absent, blocked, or changed remote stays isolated. The mapping never creates global evidence. Removing a source uses provenance to preview guidance supported only by that source; mixed-source guidance needs review before changing a shared skill.

Binding must also reconsider only the affected episodes in the learning ledger. Before writing a binding, derive the candidate group's existing episode identifiers from its indexed events, remove matching processed entries, then bind its origin keys. Unrelated ledger entries stay intact. A later learning run can reconcile those episodes under the newly confirmed repository scope. The binding command reports how many episodes became eligible again.

`learning/provenance.ts` maps supporting evidence identifiers to the signal's indexed text references and saves named capture sources and completeness. Pending approval reopens the current effective source configuration and checks that provenance. Missing provenance or a source disabled since learning blocks approval and leaves the rule pending. Active environment records retain the same provenance. The user can reject a pending rule, re-enable its source, or learn again from authorized evidence. This check governs approval of a new proposal; disabling a source does not silently delete guidance that was already published.

`learning/catalog.ts` presents pending review, scope blockers, skill proposals, and active records through `learning list`, `pending`, and `show`. Evidence display resolves only currently consented indexed user episodes through the existing redacted materialization boundary. `learning/lifecycle.ts` previews record replacement, retirement, repository narrowing, and source removal. Preview fingerprints protect the reviewed environment state. Narrowing retires the old key and creates a distinct scoped key so old and new destinations can be reconciled independently. Retirement records rejection state to prevent silent recreation. Source removal retires only complete single-source records and rejects matching pending proposals; mixed or unknown provenance requires individual review. Scoped publication accepts explicit learning keys while preserving the automatic-maintenance setting and skips unrelated memory extraction and library conflict scans.

### Learning service and lifecycle

Move engine selection, bounded execution, reconciliation, persistence, and publication coordination from `cli/deepLearn.ts` into a service under `learning/`. CLI commands format output and ask for confirmation; the background worker supplies its previously authorized automatic decision. Keep legacy profile reads and writes behind migration adapters, with active environment storage selected explicitly rather than through misleading profile-named entry points.

Manual learning is allowed when learning was consented to, independently of background improvement. Background improvement remains a separate consent flag. The background path uses the same evidence and durability classification as manual learning, within its existing time and call limits; an English keyword is not an eligibility requirement.

An episode is marked processed only after its reconciliation result is durable as an active record, a pending proposal, an explicit rejection, or a recorded no-change reason. A failure before that point leaves it retryable. A private attempt receipt records an opaque attempt id, source and episode counts, time and engine metadata, bounded outcome codes, proposal and publication ids, and a safe next action. It stores no raw excerpt or identifying transcript path. User-facing outcomes distinguish no eligible evidence, already covered, uncertain or conflicting evidence, missing scope, awaiting review, published guidance, and engine or publication failure. The background worker persists a safe failure category instead of only `failed`.

Preference state describes whether a rule is candidate, pending review, active, or retired. Delivery state separately records pending, published, covered, or blocked destinations. Observation state separately records whether an agent loaded the guidance or a requested behavior probe passed. A user can narrow, replace, reject, retire, and undo from one review surface; the existing advanced commands remain available. A later correction to an active rule raises a review signal rather than silently rewriting it. Source-specific removal previews affected records and artifacts and uses the same ownership and undo machinery.

### First use and diagnostics

`shadowclone` without arguments presents the current setup state and one next action. `init` retains its explicit consent choices; the browser and terminal review surfaces show a learned rule, supporting redacted evidence, scope, exact proposed change, and destination. Applying it completes synchronization. No action leaves a durable pending item. Diagnostics report installed, loaded when observable, and behavior-checked separately. They also identify missing sandbox prerequisites before a model run and bound provider error output so bundled source code is not printed to the terminal.

The first-run message reports how many rules were learned, how many are active, which need review or scope, and when to restart the agent. It never treats learning as proof of delivery or delivery as proof of compliance. The default build preserves existing guidance and does not automatically equip the generic bundled workflows.

### Evaluation and public claims

Unknown and not-applicable checks are excluded from adherence denominators and counts, while their totals remain visible. An infrastructure failure before agent action has no scored outcome; a run with agent action keeps its observed checks, with missing checks reported as unknown. Each observation keeps a session identity. Bootstrap draws tasks, then complete sessions within each drawn task and arm; every check from a sampled session moves together. The same task draw is used for a paired arm difference. Synthetic fixtures cover correlated checks and error handling.

Reply scoring recognizes a fenced reply, a quoted reply, or a conventional reply label before a reply body. Ambiguous extra prose remains visible rather than guessed away. Sentence counting protects common abbreviations. Review the private forbidden-pattern definitions in the private study directory without copying them into this checkout. Reports identify the product revision and scorer version for every reused run group. The evaluation preparation disclosure states that nonconflicting proposals were applied automatically and that this is an upper-bound delivery condition relative to ordinary review.

Regenerate the published aggregate from private receipts after the scorer and bootstrap fixes. If the receipts are unavailable, remove the numerical headline until it can be recomputed. The README includes all four arms and leads with deep learning over the participant's existing skills. It does not describe point-estimate differences whose intervals include zero as established gains. Disclose one participant, one repository, tasks reused after product fixes, and the post-result headline-view decision. Freeze future tasks before coverage analysis. A later, separately authorized held-out study uses new users, repositories, and tasks, tests conflicting and temporary preferences and irrelevant guidance, and measures repeat corrections and interventions alongside adherence and task correctness. Claude Code and Codex are the evaluation targets for this work.

## Implementation sequence

`learning/maintenance` owns the choice between active environment maintenance and legacy library maintenance. Active CLI and worker callers use that service directly. `skillMaintenance/legacyUpdate` contains the legacy implementation, while the old exported update API remains a small compatibility forwarding module. Environment modules reuse discovery and synchronization primitives, not the compatibility coordinator. This removes the package-level ownership ambiguity without replacing the publication safeguards.

1. Add the shared authorized evidence selector and provider user-text normalization. Prove revocation after indexing and Codex learning with synthetic transcripts.
2. Separate manual and background consent. Move learning orchestration to the service, persist pending decisions and private attempt receipts, and make episode processing conditional on durable outcomes.
3. Add reviewed historical repository binding, source provenance and removal, and one preference review lifecycle. Migrate existing environment state without discarding records, prior revisions, or legacy recovery artifacts.
4. Publish short native rules and full skills together, repair Claude and Codex destinations and hook commands, and simplify first-run status. Verify ownership, private repository output, manual edits, conflict rollback, and undo.
5. Repair evaluation scoring and resampling, recompute public aggregates, and update the README and guides. Raise the TypeScript limit to 300 lines, retain the no-comments rule, and repair design-record numbering and long lines in touched files.

## Finding disposition

| Finding or recommendation | Decision |
| --- | --- |
| Disabled indexed sources reach learning; Codex prompts disappear | Fix at authorized evidence selection and provider normalization. |
| Historical repository rules remain unresolved | Add reviewed historical binding; keep unknown identity isolated. |
| Declined proposals disappear; onboarding couples manual and background learning | Persist the decision and split the consent controls. |
| Generic background `failed` and opaque no-change | Add durable outcome receipts and actionable reasons. |
| Claude skill reads denied; repeated routing; absolute repository paths; bare hook command | Fix provider delivery and publication ownership. |
| Generic skills lower four point estimates; large baseline reads | Make generic skills optional and remove unconditional reads. Do not infer a causal harm from the existing mixed arm. |
| English steering filter; missing prerequisites; minified error output; stale profile terminology | Fix eligibility, diagnostics, and user-facing copy. |
| Preference replacement, retirement, source removal, and repeated corrections are hard to manage | Put them in one reviewed lifecycle with revisions and undo. |
| Unknown verdicts, flattened bootstrap, fragile reply checks, misleading README baseline | Fix and recompute the report before using numerical claims. |
| Task reuse, one user and repository, key from the same learning sample, mixed product revisions, automatic approval, learning-model dependence | Disclose historical limits and add a separately authorized held-out Claude and Codex study. |
| Require a live probe for every approved rule or promise perfect compliance | Do not promise compliance. Provide an on-demand bounded probe and separate publication, loading, and behavior evidence. |
| Remove `run`, MCP, and subagents to reduce scope | Keep them as advanced features and keep them out of first use. |
| Treat source line count as an architecture defect | Reject line count as a quality metric; refactor the confirmed ownership seams and raise the file limit to 300. |
| Duplicate design numbers and very long lines | Repair affected docs and touched code without a repository-wide formatting rewrite. |

## Consequences

The change spans persistence, publication, native integrations, setup, and evaluation. Existing environment files, legacy profiles, manual instruction edits, user skills, and revision history must remain readable and reversible. Source removal can require review when one artifact contains guidance from several sources. Native instruction budgets remain bounded; overflow produces a pending reason instead of truncating or silently dropping a rule.

Cursor and Antigravity support claims remain. Their provider paths and paid evaluations are outside this implementation round. The existing `run`, MCP, and subagent interfaces remain advanced capabilities. No new dependency is justified by this design.

## Verification

Repeated-correction tracking uses the learner's durable `correction` assessments attached to existing rules, not every reinforcement or user message. Successful publication dispositions carry an optional publication time. Only later evidence against the current published fingerprint creates a private review signal. The signal stores an evidence hash, rule key, fingerprint, source, and time; retries deduplicate it. Old dispositions without publication times remain unclassified until republished. Counts are review prompts, not proof that an agent ignored guidance.

`learning probe` accepts a rule key, Claude Code or Codex, a synthetic task, and an exact expected response. Explicit `--yes` authorizes one model call with a 60-second deadline. The probe validates current owned native instructions and relevant skill fingerprints, copies their redacted contents into separate temporary home and workspace directories, and uses the native evaluation runner with read access and hooks disabled. It tests the frozen native guidance, not arbitrary personal files or hook execution. Repository rules require an explicit local integration so their installed native instructions can be frozen without fabricating hook delivery. Receipts store hashes, provider metadata, permission-denial counts, and pass/fail/error, not prompts or responses. This initial isolated probe uses the existing macOS sandbox; unsupported systems fail before a call. Live hook and package qualification remain separate checks.

Build and test with Bun 1.4.2, matching the packaged runtime dependency. Declare that version in `packageManager`, which CI's `setup-bun` action reads before installation. Direct `bun test` and the runtime selected by package scripts must exercise the same bundler; Bun 1.3.3 fails to resolve valid imports in the relocated-package fixture. Linux CI installs both `bubblewrap` and `socat` before running the tests, preserving the Claude sandbox prerequisite checks.

Run focused synthetic contract and regression tests during each stage. Invert the smallest enforcing change for each new regression test, confirm its assertion fails, restore the change, and confirm it passes. Run `bun run check`, `bun test src/skills`, and `bun run cli --help` before handoff. Validate a relocated package and a fresh private installation.

Use at most three short authenticated sessions each on Claude Code and Codex, with synthetic prompts and a disposable repository, to verify setup, one approved preference, native delivery in a fresh session, and an on-demand behavior probe. Keep personal transcripts, private receipts, and identifying paths outside the checkout. Report any provider or operating-system limitation without describing untested behavior as verified. Show the completed diff for review before committing or pushing.

## Implemented scope and qualification

### Evolution through completed work

The next increment extends maintained skills into task execution inside an existing Claude Code or Codex session. The optional `shadowclone-work` starter skill composes installed guidance. A local task service records acceptance criteria, repository requirements, selected guidance, delegation acknowledgments, verification, independent review, and the requested finish line. Loading guidance is distinct from following it. Execution records never become learning input; explicit corrections use the existing preference service.

Implement the task contract and private persistence first, then snapshot-bound verification, ownership and recovery, explicit action grants and GitHub maintenance, and finally CLI, MCP, and local browser presentation. Reuse the existing harness, skill delivery, sandbox, remote helpers, and storage primitives. Keep the headless runner and legacy profiles compatible. Version task records independently from existing receipts. Store records and guidance under private run storage, outside the checkout.

Task start reads current repository instructions and the applicable maintained guidance, freezes the required gate and verification recipes, and records the Git head plus tracked and untracked change fingerprints. Repository requirements cannot be removed by a worker. Verification runs bounded recipes in the existing credential-free sandbox and records incomplete prerequisites honestly. An independent review is required for substantive work. A changed workspace, guidance snapshot, or grant invalidates readiness. A failed check permits one repair; further failure blocks the task.

Native sessions own execution. One coordinator reserves each worktree and each file scope; up to two independent workers may run only after explicit workspace and guidance delivery acknowledgments. Unknown host capabilities use serial execution. Durable checkpoints support pause, cancel, and resume without implicit retries or deletion of work. Recovery requires the prior session to have stopped. Cleanup never removes unfinished or unpushed worktrees.

Repository grants are explicit decisions made through the local CLI, separate from learned preferences and the legacy runner's per-run approvals. Grants cover commit, push, PR creation, reply, and merge, are revocable, and are intersected with the task's requested actions and managed policy. Task helpers verify current evidence before Git writes, bind PR maintenance to the recorded repository and branch, never force push, and use exact-head merge checks. Remote operations record intent before execution; uncertain interrupted operations require reconciliation instead of blind retries. Maintenance is bounded to an active session.

Qualification uses synthetic fixtures and real local Git/CLI/MCP/sandbox runs. Authenticated host runs, paid evaluation, publication, and the external adopter pilot remain separately authorized activities. Freeze evaluation tasks before measuring preference coverage; collect accepted changes, review time, corrections, interventions, regressions, and cost without importing execution output into learning. Report unqualified host behavior explicitly.

Cancellation retains ownership until verification has stopped, including cleanup. Frozen guidance records repository instruction paths relative to the worktree; verification checks for added, removed, and changed instructions in each worker's actual checkout. A worker cannot reuse a coordinator snapshot when its repository requirements differ.

The implementation adds the opt-in workflow skill, shared CLI and MCP task operations, private versioned records, sandboxed verification recipes, attributed review, bounded worktree ownership, interruption recovery, repository action grants, GitHub action journals and reconciliation, browser progress, and matched outcome reporting. Existing skill installation and the headless runner retain their interfaces. New task records do not change legacy receipt formats or grant existing repositories new permissions.

Qualification exercised real local Git fixtures, stdio MCP initialization and task requests, the browser's recorded task view, and macOS verification sandbox protections against Git metadata writes, credential reads, external writes, and networking. A read-only GitHub CLI check confirmed the response shapes and the missing-required-checks fallback; remote write paths use synthetic contract tests. Regression checks demonstrated failure when snapshot binding or task action restrictions were removed, and reproduced instruction drift and cancellation races before fixing them.

The engineering workflow has not yet been qualified through real Claude Code or Codex agent execution, live GitHub writes, a matched held-out study, or the adopter pilot. These remain release gates. The earlier native preference-delivery qualification below covers learning and delivery, not this new task lifecycle. No throughput or security superiority follows from the local checks.

### Plugin bootstrap qualification

The packaged setup skill checks the installed CLI version before reading setup state. A bundled Node helper runs only `shadowclone --version`, with bounded output and a timeout, and requires stable CLI version 0.0.13 or newer. Missing or older installations prompt an install or upgrade decision; after approval, the skill installs the public package without elevated privileges and repeats the compatibility check. A compatible existing installation keeps its consent settings. If the public package is still too old or a different executable shadows the installation, setup stops with an actionable explanation before initialization.

Qualify the release candidate in a disposable installation prefix and agent home. Install the plugin through Claude's marketplace flow, install the packaged candidate through npm, exercise explicit consent, load and apply the browser build, and reconnect the configured stdio MCP server. Exercise both global and repository preferences in fresh Claude Code and Codex sessions, undo the recorded change, refresh integrations, and confirm their prior behavior in a second fresh session. Use synthetic guidance and tasks, four model calls at most, and private qualification output outside the checkout. This verifies the candidate package; the registry upgrade path remains contingent on publishing that candidate. The follow-up PR uses a conventional `fix:` title so its squash merge is releasable.

The implementation includes current source authorization, Codex user-message extraction, separate manual and background consent, durable proposals and attempt receipts, reviewed historical repository association, source provenance, reversible preference edits, later-correction review signals, and an on-demand native response probe. CLI and workers use learning application services; legacy profile and library entry points remain compatibility paths. Publication preserves ownership, edited native destinations, original resources, and revision recovery. Short rules are inline, workflow skills use native names, generic starter workflows are optional, and hooks use an owned launcher independent of `PATH`. Source removal records pending rejection and environment retirement together so undo restores both.

Synthetic contract tests cover each supported learning provider from capture through declined review, failed publication, retry, successful publication, and both native guidance formats. The relocated package is tested against a fresh private home, including a launcher invocation with no Shadowclone executable on `PATH`. Three short synthetic sessions per agent qualified live native delivery and the bounded probe. Both final probes matched their expected response with no permission denials. A probe pass is recorded independently from skill reads and hook observation.

The published preference-study tables were recomputed from private receipts using `session-bootstrap-2` without paid reruns. The corrected intervals establish no incremental advantage over existing user skills. Historical per-session product commits cannot be reconstructed from receipts that omitted them. Held-out users, repositories, future tasks, alternative learning models, and intervention measurements remain a separate study. The initial isolated probe requires macOS and text skill resources. Cursor and Antigravity qualification remains outside this round.

### Constellation spacing and scale

The fixed canvas layout compresses skill rows as the library grows. Replace proportional row spacing with a world layout that reserves 88 pixels per skill and separate columns for sibling branches. Pan and zoom expose the larger world without reducing the distance between nodes. Fit calculates the actual graph bounds; Reset restores a readable scale centered on the root.

The collapsed overview wraps categories into rows of at most four hubs so twelve categories remain visible instead of extending off-screen in one row. Expanding a branch uses the larger world layout, and search centers its matching skill even after category focus. List filtering updates independently of the hidden map's dimensions.

Render the existing Shadowclone mark inside the root circle and use the existing SVG icon vocabulary for category hubs. Wrap long labels within their column instead of letting them overlap neighboring branches. Libraries with more than 40 leaves begin with collapsed categories; users expand a branch to see its subcategories and skills. Search reveals matching ancestor branches, and the list view retains access to every skill. Test both dispersed and single-category libraries up to 500 skills, including spacing, expansion, search, and viewport transforms.

The live 500-skill fixture exposed discovery's 500-file limit before the renderer ran. Bound discovery at 2,000 distinct physical files and preserve the existing 8 MB byte limit, 48 KB per-skill limit, path-depth limit, and consented roots. Count a canonical file once when roots overlap. This permits a 500-skill library with native copies. Bound each category branch to ten children recursively so a single large category also opens in manageable groups. The list and search traverse every nesting level.

The packaged 500-skill build response took about eight seconds under local load, approaching Bun's default ten-second HTTP idle timeout. Set the loopback editor's idle timeout to ninety seconds, which also covers its bounded sixty-second model action. Show loading and retry states while the catalog is requested so a slow or interrupted response never looks like an empty installed library.

### Follow-up qualification results

A disposable macOS installation exercised Claude Code's marketplace installation, npm installation of the packaged 0.0.13 candidate, explicit initialization choices, browser review and application, undo, and MCP reconnection. Initialization with session learning and background learning declined retained those decisions. Installing the published 0.0.12 CLI made the setup helper report `outdated`; upgrading to the candidate made it report `ready` without changing the consent configuration. Claude Code's plugin health check reported `Connected`. Two fresh stdio connections completed initialization, tool discovery, and a context request.

Four authenticated sessions checked native delivery and removal of independently authored synthetic global and repository preferences. Each active session returned both installed preference values. After undoing the four preference decision and publication revisions and refreshing native integrations, each fresh session returned both fallback values. All four calls completed without permission denials.

| Agent | CLI | Model | Global and repository delivery | Both preferences after undo |
| --- | --- | --- | --- | --- |
| Claude Code | 2.1.284 | claude-sonnet-5-5 | Passed | Restored prior behavior |
| Codex | 0.159.0 | gpt-6-sol | Passed | Restored prior behavior |

The publisher used synthetic model responses; the four real calls tested fresh native sessions with hooks disabled by the qualification runner. The package and plugin checks exercised the installed CLI separately. This qualification does not rerun the preference study or measure an agent conducting the setup conversation. Candidate artifacts, agent output, and receipts remain outside the public checkout.

Browser qualification loaded 519 skills, including 500 synthetic skills in one category. The collapsed overview displayed every category, expansion exposed bounded subgroups, search revealed a deeply nested skill after a different branch had been focused, and the list retained all 519 entries. A final normal-library review applied a build and then restored it with undo. The registry setup path becomes available when the next release is published; creating the follow-up PR alone does not publish the CLI.
