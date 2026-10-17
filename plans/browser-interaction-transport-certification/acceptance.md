# Browser interaction transport certification

## Requirements

- A1. Introduce a provider-neutral browser interaction transport boundary and keep ORCA accessibility as its first implementation.
- A2. Keep transport command completion separate from semantic control activation, platform acceptance, and publication verification.
- A3. Add a deterministic local browser fixture and certification harness with resettable trials, raw metrics, target safety checks, and version-aware receipts.
- A4. Route LinkedIn through the transport boundary without changing active-composer, payload, visibility, exact-dispatch, or UNKNOWN semantics.
- A5. Certify ORCA only from repeated reversible-control trials; do not perform social mutation.
- A6. Audit or implement an alternative normal browser transport only if ORCA fails the certification policy.

## Constraints

- C1. No LinkedIn Post, comment, Like, Follow, Connect, message, or other social mutation.
- C2. Do not retry, reconcile, or mutate execution ce9cfc41-528b-425f-9dee-ab2563b50ed3 or uncertainty df39df1c-2f06-4c20-8e9a-4ed07f5df34c.
- C3. No fallback transport chain after durable submit intent; a future execution selects one certified transport before the submit boundary.
- C4. Do not mutate canonical production state for certification.

## Verification

- V1. Local fixture has 100% activation for stable controls and rejects stale, moving, detached, overlay, and wrong-target cases.
- V2. Transport-focused, LinkedIn, JEV/browser, exact-dispatch, activation, acceptance, UNKNOWN, and full-suite tests pass with zero new failures and the full process exits normally.
- V3. ORCA safe-control certification has at least 10 fresh reset trials per practical control, raw counts, and a documented threshold.
- V4. Transport/runtime identity is recorded, selection is deterministic, and transport cannot change after durable submit intent.
- V5. Canonical revision/hash and protected UNKNOWN records are unchanged; social mutation count and final Post clicks are zero.
