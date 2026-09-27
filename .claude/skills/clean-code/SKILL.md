---
name: clean-code
description: Read before editing code, tests, documentation, or review text in this repository. Defines TypeScript, naming, file-size, checks, and prose conventions.
---

# Clean code

Use these conventions for every change. Add `scoped-fix` for corrections and `data-handling` for capture, storage, model access, or delegated actions.

## TypeScript

- Do not use `any`, non-null assertions, or type assertions other than `as const`.
- Narrow optional values before use. With `noUncheckedIndexedAccess`, destructure an array and check the result instead of asserting an indexed element exists.
- Preserve key-value relationships with generics or typed setters. Do not cast an object assembled from unrelated keys and values.
- Await promises or attach a rejection handler. Do not discard them with `void`; use a shared `noop` when ignoring a handled rejection is intentional.
- Use one options object for functions taking two or more arguments, including internal helpers.

## Names and modules

Use full words and domain names. Keep established abbreviations such as `id` and `url`, but avoid abbreviated locals such as `stmt` or single-letter counters. Never shadow an import.

Keep files under 200 lines, including tests. Split growing modules by responsibility, expose their public interface through `index.ts`, and group tests by scenario.

## Checks and comments

Run `bun run check` before handoff, with focused tests during editing. Do not suppress lint or type errors with disable directives or TypeScript ignore comments. Existing violations are not permission to add more.

Add no code comments, including JSDoc. Express intent through names, types, functions, and tests; put design reasoning in documentation. Preserve existing comments unless their removal or revision is requested. This rule does not authorize a comment-cleanup commit. Do not add bare TODO or FIXME markers.

## Prose

Use plain words and concrete claims. Keep technical terms that the reader needs. Avoid em dashes, promotional adjectives, forced contrasts, and repeated conclusions. Remove session narration and expired instructions from permanent documentation.
