# Provider-neutral handoff versioning — Acceptance

## Requirements

- A1 Canonical upstream-style envelopes must declare `handoffVersion: 1`.
- A2 Version mismatch or omission fails closed before persistence.
- A3 Accepted envelopes normalize and persist the version without creating authority or execution state.
- A4 Existing DRY_RUN, identity, integrity, secret filtering, idempotency and UNKNOWN semantics remain unchanged.

## Constraints

- C1 Downstream marketing-seeding only; SYSTEM_AGENTIC_AI Core is frozen.
- C2 No browser, ORCA, credentials, network, canonical runtime or social mutation.
- C3 Reuse the existing distribution handoff validator/store seam.

## Verification

- V1 Focused distribution handoff tests pass.
- V2 Full Node suite has zero failures.
- V3 Syntax and diff checks pass.
