# Consent checks and capability claims

## Problem

Onboarding needed to show available sources without reading them before consent. Documentation also blurred implemented behavior, tested behavior, and future work.

## Decision

Before consent, allow only a bounded source-presence check. It returns one ephemeral boolean indicating whether the configured root exists and is non-empty. It must not retain or log entry names, counts, timestamps, paths, or provider identifiers, and it must not open source contents.

Keep transcript consent separate from Git metadata consent. Repository guidance follows exact repository and remote-owner scope. Action authorization targets the repository being changed; it cannot be inferred from a broader profile scope.

Document edit, rejection, and deletion behavior as part of the guidance lifecycle. Cleanup commands must state which recorded integrations they can remove and preserve user-owned files when ownership is uncertain.

Public capability claims must distinguish implementation, fixture coverage, and live qualification. Update the architecture diagram when the data flow or a trust boundary changes. [Documentation design](025-documentation.md) defines where current instructions and historical decisions belong.

## Verification

Prove that pre-consent discovery emits only the presence result and never reads a source entry. Exercise repository isolation, user-edit preservation, and cleanup conflicts. A passing unit test is evidence for the tested contract, not a claim about every installed provider version.
