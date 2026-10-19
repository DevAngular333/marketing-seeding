# Standing autonomous delegation proof

## Result

`LOCAL_REAL_ISOLATED_STORE` — PASS. Live LinkedIn execution remains unproven.

The existing standing campaign authorization path was exercised in an isolated
`JsonStore`. One active campaign authorization created one exact queued post;
the queue derived one execution request, one bounded one-time window, one
execution-scoped live grant and one unique execution lease without a per-post
approval, window call or grant call. The provider-neutral control plan was
re-read from persisted state and allowed only with exact campaign, account,
profile, target, content, visibility, readiness, quota, cadence, idempotency,
window, grant, kill-switch and lease bindings.

A repeated queue evaluation preserved all counts. Releasing the lease removed
only the active lease. The isolated state contained zero publication attempts
and zero published posts. No browser, ORCA, LinkedIn, network write,
credential/session material, canonical runtime state or historical UNKNOWN
record was touched.

## Evidence paths

- Implementation: `src/standing-campaign-delegation.mjs`, existing
  `SeedingService` queue/window/grant/lease path.
- Proof: `test/standing-autonomous-delegation-proof.test.mjs`.
- Acceptance: this directory's `acceptance.md`.

## Classification

- Standing authorization: `IMPLEMENTED`, `LOCAL_VERIFIED`.
- Per-post approval removal inside bounded authority: `LOCAL_VERIFIED`.
- Fresh real LinkedIn authorization/session: `NOT_AVAILABLE`.
- Live publish/acceptance/independent verification: `UNPROVEN`.
