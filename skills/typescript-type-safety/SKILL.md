---
name: typescript-type-safety
description: Represent valid state and relationships in TypeScript so invalid combinations fail at compile time. Use when designing types, parsing unknown input, or removing unsafe assertions.
metadata:
  shadowclone-category: typescript
  shadowclone-section: engineering
  shadowclone-applies-when: language=typescript and changing typed state or boundaries
---
# Represent State in TypeScript Types

## Use when

Use this skill when values change together, optional fields encode hidden states, external input enters typed code, or a type assertion is needed to make the compiler accept an operation.

## Process

1. Name the domain states and the transitions the code permits.
2. Replace groups of independent optional fields with a discriminated union when only certain combinations are valid.
3. Preserve relationships between keys and values with generics, mapped types, or a typed setter rather than erasing both to broad primitives.
4. Accept external data as `unknown` and validate it once at the boundary.
5. Narrow values through predicates, control flow, schema results, or destructuring before use.
6. Make absence explicit when it is a valid state and impossible when the caller must supply a value.
7. Return a result type that forces callers to handle meaningful failure modes.
8. Run the type checker and tests that exercise runtime validation at the boundary.

## Guardrails

- Keep one source of truth for each state discriminator.
- Prefer exhaustive switches where every union member requires behavior.
- Preserve literal relationships instead of widening values to `string` or `number` too early.
- Use runtime validation for files, network responses, environment values, and parsed JSON or YAML.
- Treat `any`, non-null assertions, and broad type assertions as evidence that a boundary or relationship is missing.
- Use a narrow assertion only when the runtime invariant is established outside TypeScript and cannot be expressed through validation or control flow.
- Avoid generic abstractions that make a local relationship harder to read than explicit types would.

When a library returns an imprecise type, contain the adaptation in one boundary function. Return a precise project type so unsafety does not spread through callers.

## Completion

The work is complete when valid states are directly constructible, invalid combinations are rejected by validation or the compiler, key-value relationships survive through the call path, the type checker passes, and no new unsafe escape is left unexplained at a boundary.
