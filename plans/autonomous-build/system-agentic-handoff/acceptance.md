# System-Agentic → Marketing-Seeding Handoff Compatibility

## Requirements

- A1. Accept a provider-neutral System-Agentic handoff using the existing ProductRun / ProductArtifact / MediaArtifact / ContentVariant / ContentPackage / DistributionIntent vocabulary, without adding a second campaign store, router, browser abstraction, publisher, or state machine.
- A2. Validate exact product identity, declared content/media references, SHA-256 media integrity and bounded JSON before persistence; reject credential/session/browser/provider execution internals and LIVE dispatch.
- A3. Map an accepted dry-run handoff into the existing campaign-owned distribution handoff/content evidence path idempotently, preserving current campaign authorization and publication safety semantics.
- A4. Persist only sanitized metadata and stable hashes; never persist raw credentials, cookies, auth tokens, browser profiles, selectors, ORCA/JEV details or platform execution controls from the upstream envelope.
- A5. Keep the seam non-authoritative: no execution request, grant, lease, browser call, publication attempt, quota consumption or external side effect may be created.

## Constraints

- C1. SYSTEM_AGENTIC_AI Production Core is frozen; changes are limited to this marketing-seeding integration branch and plan journal.
- C2. Existing `distribution-handoff.mjs`, `JsonStore`, campaign state, authorization, execution, UNKNOWN quarantine and LinkedIn semantics remain authoritative.
- C3. Canonical production state and all historical UNKNOWN executions remain read-only and unchanged.
- C4. Only synthetic/local fixtures may be used; no network, browser, social mutation, publish, login or credential inspection.
- C5. LIVE mode must fail closed. No new live authority is derived from the handoff.

## Verification

- V1. Focused handoff and service tests cover valid canonical dry-run input, exact identity/integrity mismatch, forbidden execution/credential fields, idempotent restart persistence and zero dispatch side effects.
- V2. Full Node suite has zero new failures; syntax and diff checks pass.
- V3. Independent read-only review inspects the final diff and reruns focused checks after the last change.
- V4. Canonical runtime revision/hash and protected UNKNOWN IDs are unchanged after the milestone.
