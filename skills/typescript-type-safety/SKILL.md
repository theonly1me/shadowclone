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

Values change together, optional fields hide distinct states, external input enters typed code, or an assertion is needed to satisfy the compiler.

## Process

1. Name valid states and transitions. Use discriminated unions when only certain field combinations are valid.
2. Preserve key-value relationships with generics, mapped types, or a typed setter.
3. Accept external input as `unknown` and validate it at the boundary.
4. Narrow through control flow, predicates, schemas, or destructuring. Make valid absence explicit.
5. Return types that require callers to handle meaningful failures.
6. Run type checks and tests for runtime validation.

## Guardrails

Keep one source of truth for each discriminator and handle every union member where behavior must be exhaustive. Preserve literals instead of widening them prematurely.

Treat `any`, non-null assertions, and broad casts as signs of a missing relationship or boundary. A narrow assertion is appropriate only when an externally established runtime invariant cannot be expressed through validation or control flow. Follow stricter repository rules where they apply.

Contain imprecise library types in one adapter returning a precise project type. Avoid generic abstractions that obscure a simple relationship.

## Completion

Valid states are constructible, invalid combinations are rejected, relationships survive the call path, and type and boundary checks pass.
