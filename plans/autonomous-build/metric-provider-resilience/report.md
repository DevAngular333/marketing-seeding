# Metric Provider Resilience

## Unverified first

- No live provider, credential, browser, ORCA, canonical runtime, or external social action was used.
- Provider-specific permissions and live rate-limit behavior remain unverified.

## Scope

The existing `requestJson()` retry seam now respects a valid provider `Retry-After` hint for retryable responses, caps the resulting delay, and falls back to the existing bounded exponential delay for malformed or absent hints. Test-only sleep injection makes the policy deterministic without changing production I/O. Non-retryable responses remain fail-fast.

The existing metric collectors, persistence, checkpoint projection, authority, execution, and UNKNOWN quarantine were not changed.

## Evidence

See `test/integrations.test.mjs` for fixture coverage. The focused
integration/service/server gate is **70 passed, 0 failed, 0 skipped** and the
full Node suite is **444 total, 442 passed, 0 failed, 2 skipped**. Source
syntax checks and `git diff --check` pass. An independent bounded review
returned **PASS** after the signed negative-hint regression was corrected.

## Remaining gaps

- Live provider rate-limit responses and permissions still require a separately authorized provider lane.
- The metric scheduler remains bounded and due-aware but does not guarantee exact provider cadence.
