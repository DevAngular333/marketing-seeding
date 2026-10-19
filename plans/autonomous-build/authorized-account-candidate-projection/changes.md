# Changes

- Reused the existing `SeedingService.dashboard()` read model and account,
  target, authorization and readiness contracts.
- Added `projectAuthorizedAccountCandidates()` in `src/service.mjs`.
- Candidate rows are derived only from persisted authorization destinations and
  expose a bounded stable key, platform/account/target identity, profile
  fingerprint, session/auth mode, safe readiness summary and fail-closed
  eligibility reasons.
- Added no selector, failover, login, credential broker, target rebinding,
  execution request, window, grant, lease, browser or provider behavior.
- Added three isolated regression tests covering deterministic safe projection,
  negative authorization/readiness reasons, dashboard restart equality and zero
  execution artifacts.
