# Changes

- Extended the existing `projectExecutionAccountRuntime` dashboard projection with `sessionMode`, `authMode`, `eligibleForExecution`, and deterministic `ineligibilityReasons`.
- Eligibility is derived only from existing status, health, exact bound-target count, and latest bound readiness/expiry.
- Added focused synthetic tests for eligible READY, missing/expired, disabled/unhealthy, HUMAN_REQUIRED/UNKNOWN, restart equality, redaction, and no authority side effects.
- No login, credential, browser, ORCA, JEV, authority, grant, window, lease, submit, verification, or UNKNOWN semantics changed.
