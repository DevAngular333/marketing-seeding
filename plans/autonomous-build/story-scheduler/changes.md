# Changes

- Added a bounded `storyPolicy` to normalized `approved_template_set`
  campaign authorization content boundaries.
- Bounded and credential/session-filtered CTA, disclosure and language values;
  the policy participates in the authorization fingerprint.
- Extended queue-owned template scheduling to derive a deterministic story from
  the existing READY product-intelligence handoff.
- Added pre-derivation checks for active campaign state, one exact active
  standing authority, authorization fingerprint and campaign-scope fingerprint.
- Preserved existing candidate identity, source/claim/render validation,
  materialization, readiness, request, window, grant, lease, idempotency and
  UNKNOWN semantics.
- Added focused regressions for stale/tampered authority and execution-state
  immutability.
