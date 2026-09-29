# Evaluation results

The preference study measures whether a coding agent follows an anonymized participant's engineering preferences on ordinary requests, and whether Shadowclone changes that. Each agent has its own tasks and checks, so compare setups within an agent, not agents with each other.

## Results

The headline rate weights every task equally. Percentages in parentheses are 95% intervals.

| Share of preferences followed | GPT-6 Sol | GPT-6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Agent alone | 72% (52% to 89%) | 73% (54% to 90%) | 55% (27% to 80%) | 57% (32% to 82%) |
| With existing skills | 87% (70% to 100%) | 91% (79% to 99%) | 70% (42% to 96%) | 79% (56% to 100%) |
| With Shadowclone skills | 84% (68% to 98%) | 83% (68% to 95%) | 68% (40% to 92%) | 68% (42% to 90%) |
| With Shadowclone skills and deep learning | 97% (88% to 100%) | 88% (74% to 99%) | 76% (54% to 95%) | 82% (64% to 97%) |

Each cell below compares the agent alone with Shadowclone skills and deep learning.

| Preference | GPT-6 Sol | GPT-6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Review reply preferences | 2 of 6 → 6 of 6 | 2 of 6 → 6 of 6 | 0 of 6 → 6 of 6 | 0 of 6 → 6 of 6 |
| Failing test first | 0 of 3 → 3 of 3 | 0 of 3 → 2 of 3 | 0 of 3 → 0 of 3 | 0 of 3 → 2 of 3 |
| Pull request checklist | 0 of 3 → 3 of 3 | 3 of 3 → 3 of 3 | 0 of 3 → 1 of 3 | 2 of 3 → 3 of 3 |

**How to read this.** Skills with deep learning beat the agent alone on all four agents by 15 to 25 points. The gain is statistically clear on GPT-6 Sol and Opus 5.5, and directional on GPT-6 Luna and Sonnet 5.5. Existing skills scored in the same range and slightly higher on GPT-6 Luna. The intervals are wide because each agent has four to ten tasks.

## Setups

| Setup | What the agent has |
| --- | --- |
| Without Shadowclone or user skills | Repository guidance only, with personal memory disabled |
| With user skills | The participant's existing skills and instructions |
| With Shadowclone skills | The existing skills plus Shadowclone setup with a scripted agent build |
| With Shadowclone skills and deep learning | The same setup after learning from a consented 14-day session sample until none remained |

Each setup runs in an isolated agent home. The setups with user skills start from identical native memory, and no setup receives an aggregated profile.

**Existing skills.** The participant's library was frozen before the study and not tuned for it. The third setup adds generic Shadowclone skills and edits the native instruction files to route to them. The study does not separate those two changes.

## How the tasks and checks were chosen

**Preference key.** One frozen key of 17 items has four provenance groups: rules in the existing skill library, behavior the wizard build selects, preferences evidenced at least twice in the consented session sample, and decisions on pending proposals. Key items never come from the deep-learning skills. Session text is not stored, only counts.

**Requests.** Ten candidate requests run on a synthetic repository, a usage-reporting tool. Each is written in the short style people use with coding agents: a terse first request that carries most of the detail and, on two tasks, one short follow-up. No request states a preference. Prompts are sent verbatim with no evaluation preamble.

**Repository.** The repository has modules near the file-length limit, tests, release notes, Git history on a ticketed branch, a local remote, and an offline `gh` stub that records pull request creation. Code tasks carry hidden acceptance tests.

**Kinds of tasks.** The requests cover the work an agent does in a day, and each kind exercises different preferences.

| Kind | Requests | Preferences checked |
| --- | --- | --- |
| Feature work | Add a second export format; parse older config files | One options object for several parameters; no unsafe types; no added comments |
| Bug fix | Successful jobs still get retried | Failing test first; fix proven by inversion; commit message proposed, not committed |
| Git and pull requests | Rename a variable, then "commit it"; create the pull request | Lowercase conventional subject with no body; an Overview of Changes checklist |
| Questions | Which change broke exports, then "do we need a hotfix?"; is a delay capped; what would a change take | Short, direct answers |
| Review replies | Reply to an automated review comment | One sentence with the key fact, no colons, semicolons, or dashes |
| Documentation | Remove a deprecated command and sweep the docs | No em dashes in prose; no added comments |

**Checks.** Every check is deterministic: introduced comments and unsafe types, positional parameters, action order for test-first and inversion proofs, commit subjects, pull request records, and answer length or sentence count. Test results come from command output, and an answer is the final message. Attribution lines agents add on their own, such as `Co-Authored-By`, are ignored.

**Controls.** Before any setup ran, each agent ran every request twice without help and twice "told", meaning the request plus the preferences stated in the prompt. A check is achievable when told passes both runs. Checks the agent fails or cannot apply even when told are dropped, because they measure the check.

**Two views.** The headline view keeps every achievable check, including those the unaided agent already meets, so the baseline is real. The second view keeps only achievable checks the unaided agent failed at least once in controls. It shows preferences an agent does not follow on its own, and it pushes the baseline near zero by design.

**Order of decisions.** The second view was the first analysis. The headline view was added after those results, because a baseline forced near zero inflates gains. Sessions did not change, and both views are reported.

**Per-agent suites.** Agents differ in what they do by default, so each agent has its own checks.

| Agent | Candidate checks | Already met | Failed or n/a when told | Achievable | Missed by default | Tasks (achievable, missed) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Sol, medium effort | 25 | 14 | 1 | 24 | 10 | 10, 8 |
| GPT-6 Luna, high effort | 25 | 18 | 1 | 24 | 6 | 10, 4 |
| Sonnet 5.5, high effort | 25 | 14 | 4 | 21 | 7 | 8, 4 |
| Opus 5.5, medium effort | 25 | 13 | 4 | 21 | 8 | 8, 4 |

**Answer length.** GPT-6 Sol was validated first with a 60-word limit, which its second view still uses. Sonnet 5.5 and Opus 5.5 did not meet 60 words even when told, so the headline views use 100 words, and 150 for the planning answer. Sol's controls ran on an earlier pool of 28 that held two attribution checks and one judged check, which the shared 25 omit.

**Coverage gate.** A separate audit records which key items each setup's guidance covers, with verbatim quotes checked against the files. The study stops if deep learning covers nothing that Shadowclone skills alone lack.

**Analysis.** Each setup ran three sessions per task. Rates weight tasks equally. Intervals resample tasks and then sessions within a task, so run-to-run variation widens them, and a comparison counts only when its 95% interval excludes zero.

**Noise.** The half-width of the deep-learning-over-no-help interval is the smallest gain the design separates from noise: about 16 points for GPT-6 Sol, 17 for GPT-6 Luna, 27 for Sonnet 5.5, and 25 for Opus 5.5.

## Detailed results

Cells show checks followed out of checks run and the corresponding percentage, pooled over sessions. Errored sessions are excluded from the counts.

| Setup | GPT-6 Sol | GPT-6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Without Shadowclone or user skills | 47 of 72 (65%) | 46 of 69 (67%) | 35 of 60 (58%) | 35 of 60 (58%) |
| With user skills | 58 of 68 (85%) | 62 of 72 (86%) | 44 of 63 (70%) | 50 of 63 (79%) |
| With Shadowclone skills | 59 of 71 (83%) | 57 of 72 (79%) | 43 of 61 (70%) | 42 of 60 (70%) |
| With Shadowclone skills and deep learning | 65 of 69 (94%) | 61 of 72 (85%) | 47 of 61 (77%) | 50 of 60 (83%) |

Deep learning followed the highest pooled share on GPT-6 Sol, Sonnet 5.5, and Opus 5.5. Existing skills followed the highest share on GPT-6 Luna. The task-weighted headline remains the primary comparison because tasks have different numbers of checks.

Differences in points, with 95% intervals. An asterisk marks an interval that excludes zero.

| Comparison | GPT-6 Sol | GPT-6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Deep learning over no help | +25 (+10 to +42) * | +15 (-1 to +33) | +22 (-3 to +50) | +25 (+1 to +52) * |
| Deep learning over user skills | +10 (+0 to +25) | -3 (-14 to +8) | +6 (-20 to +38) | +3 (-16 to +26) |
| Deep learning over Shadowclone skills | +12 (+0 to +29) | +6 (-7 to +19) | +8 (-16 to +40) | +15 (-6 to +42) |
| Shadowclone skills over no help | +13 (-1 to +27) | +9 (-5 to +24) | +13 (-7 to +38) | +10 (-5 to +27) |

**What is clear.** Deep learning over no help is clear on GPT-6 Sol and Opus 5.5 and not on GPT-6 Luna or Sonnet 5.5. Shadowclone skills over no help is not clear on any agent. No comparison between two setups with skills is clear.

**Where the gains come from.** Deep learning followed both review-reply checks in all three sessions on all four agents. User skills followed 3 of 6 and 5 of 6 on the two Codex models and 0 of 6 and 2 of 6 on the two Claude models.

**Where it fell short.** On Sonnet 5.5, deep learning met the pull request checklist in 1 of 3 sessions against 3 of 3 for user skills and Shadowclone skills. On GPT-6 Luna, user skills led. On GPT-6 Luna and Opus 5.5, Shadowclone skills alone followed a lower share than user skills.

### GPT-6 Sol

| Task | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | ---: | ---: | ---: | ---: |
| Add TSV export | 9 of 12 (75%) | 8 of 8 (100%) | 11 of 11 (100%) | 9 of 9 (100%) |
| Fix retries | 3 of 12 (25%) | 6 of 12 (50%) | 8 of 12 (67%) | 8 of 12 (67%) |
| Explain a regression | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) |
| Reply to a review comment | 2 of 6 (33%) | 3 of 6 (50%) | 2 of 6 (33%) | 6 of 6 (100%) |
| Create a pull request | 3 of 6 (50%) | 6 of 6 (100%) | 4 of 6 (67%) | 6 of 6 (100%) |
| Rename and commit | 6 of 9 (67%) | 9 of 9 (100%) | 7 of 9 (78%) | 9 of 9 (100%) |
| Parse older configs | 6 of 9 (67%) | 9 of 9 (100%) | 9 of 9 (100%) | 9 of 9 (100%) |
| Remove a deprecated command | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) |
| Answer a question | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) |
| Plan a change | 3 of 3 (100%) | 2 of 3 (67%) | 3 of 3 (100%) | 3 of 3 (100%) |
| **All checks** | 47 of 72 (65%) | 58 of 68 (85%) | 59 of 71 (83%) | 65 of 69 (94%) |

### GPT-6 Luna

| Task | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | ---: | ---: | ---: | ---: |
| Add TSV export | 9 of 12 (75%) | 10 of 12 (83%) | 9 of 12 (75%) | 9 of 12 (75%) |
| Fix retries | 3 of 12 (25%) | 6 of 12 (50%) | 6 of 12 (50%) | 6 of 12 (50%) |
| Explain a regression | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) |
| Reply to a review comment | 2 of 6 (33%) | 5 of 6 (83%) | 4 of 6 (67%) | 6 of 6 (100%) |
| Create a pull request | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) |
| Rename and commit | 6 of 9 (67%) | 8 of 9 (89%) | 6 of 9 (67%) | 8 of 9 (89%) |
| Parse older configs | 6 of 9 (67%) | 12 of 12 (100%) | 12 of 12 (100%) | 12 of 12 (100%) |
| Remove a deprecated command | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) |
| Answer a question | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) |
| Plan a change | 2 of 3 (67%) | 3 of 3 (100%) | 2 of 3 (67%) | 2 of 3 (67%) |
| **All checks** | 46 of 69 (67%) | 62 of 72 (86%) | 57 of 72 (79%) | 61 of 72 (85%) |

### Sonnet 5.5

| Task | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | ---: | ---: | ---: | ---: |
| Add TSV export | 8 of 8 (100%) | 9 of 9 (100%) | 9 of 9 (100%) | 9 of 9 (100%) |
| Fix retries | 3 of 12 (25%) | 3 of 12 (25%) | 3 of 12 (25%) | 3 of 12 (25%) |
| Reply to a review comment | 0 of 6 (0%) | 0 of 6 (0%) | 0 of 6 (0%) | 6 of 6 (100%) |
| Create a pull request | 1 of 6 (17%) | 6 of 6 (100%) | 6 of 6 (100%) | 4 of 6 (67%) |
| Rename and commit | 9 of 9 (100%) | 9 of 9 (100%) | 9 of 9 (100%) | 9 of 9 (100%) |
| Parse older configs | 7 of 9 (78%) | 8 of 9 (89%) | 9 of 9 (100%) | 9 of 9 (100%) |
| Remove a deprecated command | 4 of 4 (100%) | 6 of 6 (100%) | 4 of 4 (100%) | 4 of 4 (100%) |
| Answer a question | 3 of 6 (50%) | 3 of 6 (50%) | 3 of 6 (50%) | 3 of 6 (50%) |
| **All checks** | 35 of 60 (58%) | 44 of 63 (70%) | 43 of 61 (70%) | 47 of 61 (77%) |

### Opus 5.5

| Task | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | ---: | ---: | ---: | ---: |
| Add TSV export | 9 of 9 (100%) | 9 of 9 (100%) | 9 of 9 (100%) | 9 of 9 (100%) |
| Fix retries | 3 of 12 (25%) | 6 of 12 (50%) | 5 of 12 (42%) | 6 of 12 (50%) |
| Reply to a review comment | 0 of 6 (0%) | 2 of 6 (33%) | 0 of 6 (0%) | 6 of 6 (100%) |
| Create a pull request | 2 of 3 (67%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) |
| Rename and commit | 6 of 6 (100%) | 9 of 9 (100%) | 6 of 6 (100%) | 6 of 6 (100%) |
| Parse older configs | 6 of 12 (50%) | 12 of 12 (100%) | 10 of 12 (83%) | 11 of 12 (92%) |
| Remove a deprecated command | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) | 6 of 6 (100%) |
| Answer a question | 3 of 6 (50%) | 3 of 6 (50%) | 3 of 6 (50%) | 3 of 6 (50%) |
| **All checks** | 35 of 60 (58%) | 50 of 63 (79%) | 42 of 60 (70%) | 50 of 60 (83%) |

## Preferences each agent misses by default

This view keeps only checks the unaided agent failed at least once in controls. The baseline is near zero by design, so the counts show adoption, not the size of a typical gain.

| Setup | GPT-6 Sol | GPT-6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Without Shadowclone or user skills | 6 of 30 (20%) | 2 of 18 (11%) | 0 of 21 (0%) | 0 of 24 (0%) |
| With user skills | 16 of 27 (59%) | 9 of 18 (50%) | 3 of 21 (14%) | 11 of 24 (46%) |
| With Shadowclone skills | 17 of 29 (59%) | 5 of 18 (28%) | 3 of 21 (14%) | 6 of 24 (25%) |
| With Shadowclone skills and deep learning | 21 of 27 (78%) | 7 of 18 (39%) | 7 of 21 (33%) | 14 of 24 (58%) |

**Not met by any setup.** No session met the check for proposing a one-line commit message instead of committing. No setup kept Sonnet 5.5 or Opus 5.5 answers to a direct question within 100 words. On Sonnet 5.5, no setup produced a failing test first or an inversion proof.

### GPT-6 Sol

| Task | Preference checked | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | --- | ---: | ---: | ---: | ---: |
| Add TSV export | One options object for several parameters | 0 of 3 | n/a | 2 of 2 | n/a |
| Fix retries | Failing test first | 0 of 3 | 2 of 3 | 3 of 3 | 3 of 3 |
| Fix retries | Fix proven by inversion | 0 of 3 | 1 of 3 | 2 of 3 | 2 of 3 |
| Fix retries | Commit message proposed, not committed | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |
| Explain a regression | Hotfix answer within 60 words | 3 of 3 | 1 of 3 | 1 of 3 | 1 of 3 |
| Reply to a review comment | One-sentence reply | 0 of 3 | 0 of 3 | 0 of 3 | 3 of 3 |
| Create a pull request | Overview of Changes checklist | 0 of 3 | 3 of 3 | 2 of 3 | 3 of 3 |
| Rename and commit | Lowercase conventional subject, no body | 0 of 3 | 3 of 3 | 1 of 3 | 3 of 3 |
| Parse older configs | No unsafe type syntax | 0 of 3 | 3 of 3 | 3 of 3 | 3 of 3 |
| Answer a question | Answer within 60 words | 3 of 3 | 3 of 3 | 3 of 3 | 3 of 3 |

### GPT-6 Luna

| Task | Preference checked | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | --- | ---: | ---: | ---: | ---: |
| Add TSV export | One options object for several parameters | 0 of 3 | 1 of 3 | 0 of 3 | 0 of 3 |
| Fix retries | Failing test first | 0 of 3 | 1 of 3 | 0 of 3 | 2 of 3 |
| Fix retries | Fix proven by inversion | 0 of 3 | 2 of 3 | 3 of 3 | 1 of 3 |
| Fix retries | Commit message proposed, not committed | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |
| Rename and commit | Lowercase conventional subject, no body | 0 of 3 | 2 of 3 | 0 of 3 | 2 of 3 |
| Plan a change | Plan within 150 words | 2 of 3 | 3 of 3 | 2 of 3 | 2 of 3 |

### Sonnet 5.5

| Task | Preference checked | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | --- | ---: | ---: | ---: | ---: |
| Fix retries | Failing test first | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |
| Fix retries | Fix proven by inversion | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |
| Fix retries | Commit message proposed, not committed | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |
| Reply to a review comment | One-sentence reply | 0 of 3 | 0 of 3 | 0 of 3 | 3 of 3 |
| Reply to a review comment | Key fact, no colons, semicolons, or dashes | 0 of 3 | 0 of 3 | 0 of 3 | 3 of 3 |
| Create a pull request | Overview of Changes checklist | 0 of 3 | 3 of 3 | 3 of 3 | 1 of 3 |
| Answer a question | Answer within 100 words | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |

### Opus 5.5

| Task | Preference checked | Without Shadowclone or user skills | With user skills | With Shadowclone skills | With Shadowclone skills and deep learning |
| --- | --- | ---: | ---: | ---: | ---: |
| Fix retries | Failing test first | 0 of 3 | 0 of 3 | 1 of 3 | 2 of 3 |
| Fix retries | Fix proven by inversion | 0 of 3 | 3 of 3 | 1 of 3 | 1 of 3 |
| Fix retries | Commit message proposed, not committed | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |
| Reply to a review comment | One-sentence reply | 0 of 3 | 0 of 3 | 0 of 3 | 3 of 3 |
| Reply to a review comment | Key fact, no colons, semicolons, or dashes | 0 of 3 | 2 of 3 | 0 of 3 | 3 of 3 |
| Parse older configs | No added comments | 0 of 3 | 3 of 3 | 2 of 3 | 3 of 3 |
| Parse older configs | One options object for several parameters | 0 of 3 | 3 of 3 | 2 of 3 | 2 of 3 |
| Answer a question | Answer within 100 words | 0 of 3 | 0 of 3 | 0 of 3 | 0 of 3 |

## Run notes

**Versions.** GPT-6 Sol and Luna ran through Codex CLI 0.156.1. Sonnet 5.5 ran through Claude Code 2.1.277. Opus 5.5 ran through Claude Code 2.1.284.

**Sessions.** The tables cover 432 sessions. Six ended in an infrastructure error after the agent had acted, three on Sonnet 5.5 and three on Opus 5.5, and are excluded from the counts. No session had a correctness or safety failure.

**Replacements.** A session that ended in an infrastructure error before the agent acted was replaced once and the failed record was kept. A session with an agent action kept its result.

**Not reported.** Sessions on tasks outside an agent's achievable tasks also ran. They are not scored here.

**GPT-6 Sol.** Its first 96 sessions come from the first scored run and a rerun after product fixes to skill publication, scope, and precedence. The [design record](docs/design/027-preference-study.md) describes them. Rescoring them with the final scorer changed no verdict.

## Repository harness pilot (2026-09-26)

Two synthetic repositories each ran once with existing guidance and once after repository setup. Claude Code used `--model sonnet` and `acceptEdits`. Both arms received the same task, and held-out acceptance tests were added afterward. The setup arm used four rules: no TypeScript comments, files under 200 lines, a failing test for new behavior, and no commit.

| Repository | Arm | Held-out acceptance | Gate | Tests added | Agent committed |
| --- | --- | --- | --- | --- | --- |
| Bun task list | baseline | 3 of 3 | pass | yes | no |
| Bun task list | setup | 3 of 3 | pass | yes | no |
| Python config | baseline | pass | pass | no | no |
| Python config | setup | pass | pass | yes | no |

Both arms solved both tasks. The Python baseline skipped a test while the configured agent added one.

## Reproduce

The [evaluation guide](docs/architecture/09-evaluation.md) lists the phases and commands. Suites, keys, homes, and receipts stay in a private directory outside the checkout, and the public repository holds only the harness and synthetic fixtures.
