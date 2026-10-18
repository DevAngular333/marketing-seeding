# Changes

- Added a bounded cached Product Factory capability projection to
  `SeedingService.dashboard()` and `/health`.
- Added Mission Control read-only rendering for profile, checks, limits,
  eligibility and `NOT_EXECUTED_UNSAFE` disposition.
- Added service and server regressions for cache reuse, probe failures,
  sanitization, no state mutation and health/dashboard parity.
- Fixed the sanitizer allowlist to preserve the valid `AVAILABLE` result from
  an all-PASS audited probe, with a regression for eligibility and bounded
  check/limit projection.
- Preserved existing Product Factory command rejection and all publication and
  UNKNOWN safety contracts.
