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

Keep files at most 300 lines, including tests. Split growing modules by responsibility, expose their public interface through `index.ts`, and group tests by scenario.

## Formatting and readability

Match the layout of established files such as `src/web/review.ts` and `src/storage/write.ts`.

- Use two spaces for indentation. Prettier wraps code at a target width of 100 characters from `.prettierrc.json`.
- Put blank lines between declarations, guards, and distinct steps. Keep related statements together.
- Expand long options objects, parameter types, schemas, and conditions across multiple lines.
- Give a guard its own block. Do not put a condition, a throw, and the next step on one line.
- Split a long conditional expression into named values or a small function when that makes the decision easier to read.
- Never compress code to meet a file-size limit. Split the module by responsibility when its readable form exceeds the limit.
- Format the changed files before handoff:

  `bun run format <changed files>`

- Check the changed files with `bun run format:check <changed files>`.
- Prettier does not wrap every string or template literal. Break long prose strings and generated source into readable lines yourself.

The formatter controls indentation and wrapping. Check blank lines and logical grouping separately against nearby files.

## Checks and comments

Run `bun run check` before handoff, with focused tests during editing. Do not suppress lint or type errors with disable directives or TypeScript ignore comments. Existing violations are not permission to add more.

Add no code comments, including JSDoc. Express intent through names, types, functions, and tests; put design reasoning in documentation. Preserve existing comments unless their removal or revision is requested. This rule does not authorize a comment-cleanup commit. Do not add bare TODO or FIXME markers.

## Prose

Use plain words and concrete claims. Keep technical terms that the reader needs. Avoid em dashes, promotional adjectives, forced contrasts, and repeated conclusions. Remove session narration and expired instructions from permanent documentation.
