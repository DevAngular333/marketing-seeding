# Discovery fit compatibility — Acceptance

## Requirements

- **A1** A discovery processed without explicit audience, channel, or locale fit
  hints must retain the legacy no-fit shape and remain eligible for the existing
  advisory strategy relevance gate.
- **A2** Explicit fit hints continue to persist deterministic `MATCHED`,
  `MISMATCHED`, or `UNKNOWN` evidence; explicit mismatch/unknown remains
  excluded from advisory strategy.
- **A3** Discovery identity, classification, score, persistence, and dashboard
  projection remain unchanged by the compatibility fix.

## Constraints

- **C1** Change only the existing discovery/strategy seam and its regression
  tests; do not add a store, state machine, provider, browser, or router.
- **C2** No network, credentials, browser, social mutation, authority,
  request, grant, window, lease, publication, or UNKNOWN submission mutation.
- **C3** Preserve explicit fit fail-closed semantics and historical UNKNOWN
  immutability.

## Verification

- **V1** Discovery and strategy focused tests pass with zero failures.
- **V2** Service/discovery scheduler regression and full Node suite have zero
  new failures.
- **V3** Source syntax and `git diff --check` pass.
- **V4** Read-only review confirms only no-fit compatibility changed and no
  execution or authority path changed.

