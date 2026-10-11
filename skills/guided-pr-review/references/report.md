# Report contract

## Files and commands

Write one input JSON outside the checkout. The collector replaces file inventories with actual Git data and verifies each quoted excerpt.

1. Run `node scripts/collect.mjs input.json report.json`.
2. Run `node scripts/render.mjs report.json review.html`.
3. Run `node scripts/validate.mjs review.html`.

Run these commands from this skill's folder. Outputs use private permissions and refuse existing paths, including symbolic links. Use a new output path for a revised report.

## Input

The root fields are `version: 1`, `title`, `generatedAt`, `summary`, `pulls`, `evidence`, `groups`, `proposals`, and `coverage`.

Use lowercase ids with letters, numbers, and hyphens. Use Markdown in summaries and before-and-after explanations. Other prose fields use plain text.

Each pull has these fields:

| Field                | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| `id`                 | A unique id, such as `pr-1`                                      |
| `repository`         | The GitHub owner and repository                                  |
| `number`             | The positive PR number                                           |
| `title`, `url`       | The actual title and matching GitHub PR URL                      |
| `checkout`           | A local repository with all requested commit objects             |
| `baseSha`, `headSha` | Full pinned commit SHAs                                          |
| `ci`                 | Actual check records with `name` and `status`, or an empty array |

The collector adds `mergeBaseSha` and the complete `files` inventory. It removes `checkout` from the output. Each file includes its actual diff, source sides, line rows, change status, and counts.

## Source evidence

Each evidence record has `id`, `pr`, `path`, `side`, `start`, `end`, and `quote`.

`side` is `HEAD` or `BASE`. BASE means the PR's merge base. Lines are one-based and inclusive. The quote must exactly match those lines, without the final newline.

The collector adds the actual `sha` and `text`. A mismatch stops collection before writing an output file.

## Behaviour groups

Each group has `id`, `title`, `summary`, `why`, `before`, `after`, `prs`, `evidence`, `files`, `steps`, `dryRuns`, and `diagram`.

- `prs` lists contributing PR ids. Order groups by the human's reading route.
- `evidence` lists source evidence ids.
- `files` lists `{pr, path}` records from the actual diffs.
- `steps` lists `{title, text, evidence}` records.
- `diagram` contains `nodes` and `edges`. Empty arrays omit the visual.

Each diagram node has `id`, `label`, and `evidence`. Each edge has `from`, `to`, `label`, and `evidence`. Every node and transition needs evidence. Labels describe the code's behaviour, not an imagined architecture.

Each dry run has `title`, `kind`, `input`, `steps`, and `outcome`. Its kind is `reasoned` or `executed`. An executed check also needs its actual `command`.

Each dry-run step has `branch`, `state`, `effects`, `outcome`, and a nonempty `evidence` array. Include the failure state and existing guards when they determine the result.

## Proposals and coverage

Each proposal has `id`, `group`, `pr`, `evidence`, `body`, `reason`, `verification`, and `counterevidence`.

The body contains proposed reviewer wording. Explain the triggering flow in the reason. State source proof or an actual check in verification. State what you examined to disprove the concern in counterevidence.

Only propose comments supported by the code and relevant to real use. A supported question can remain a question. Unresolved speculation belongs in the guide with its limit, not an asserted defect.

Each coverage record has `pr`, `path`, `status`, and `reason`. Use `reviewed`, `generated`, or `unexamined`. Include every changed file once. The document labels this coverage as agent-reported.

The collector records actual inheritance as `stackEdges`. It sets `combinedHead` only when one supplied head contains every other supplied head. Do not replace missing ancestry with a synthetic stack.

## Human notes

The document keeps original wording, editable text, PR targets, document anchors, selected quotes, and source references. Notes export separately from the report. A regenerated report at different commits has a different identity.

The human selects which notes to stage. Opening the document or revealing proposals does not authorize GitHub feedback. The standalone document retains notes and exports without a CLI connection.
