# Content Candidate Materialization

## Acceptance

- A1. Materialize an exact persisted campaign content candidate into one `state.posts` draft.
- A2. Require exact campaign, candidate, target, channel, content identity, and recomputed content hash/identity matches.
- A3. Require the target to exist and be campaign-bound through existing campaign posts or authorization destinations.
- A4. Keep the operation draft-only: no authorization binding, lifecycle, queue, readiness, execution, grant, lease, browser, or UNKNOWN writes.
- A5. Repeated calls and restart are idempotent using `publicationIdentityKey`.
- A6. Expose the operation through an automation-safe server route without adding approval UI.

## Constraints

- C1. Reuse `SeedingService`, `JsonStore`, and existing identity/policy contracts.
- C2. Do not create a store, router, state machine, publisher, or browser abstraction.
- C3. Do not mutate historical UNKNOWN records or canonical execution state.
- C4. Do not weaken existing authorization or publication safety semantics.

## Verification

- V1. Focused service tests cover success, idempotency/restart, tampering, target binding, and side-effect absence.
- V2. Focused server test covers authenticated automation route and draft-only result.
- V3. Node syntax checks and `git diff --check` pass.
