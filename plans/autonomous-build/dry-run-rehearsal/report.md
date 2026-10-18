# Autonomous JEV Dry-Run Rehearsal

Implemented a bounded opt-in scheduler lane for existing dry-run execution requests. The new service query is strictly isolated from live dispatch: it requires `REQUEST_READY`, `NOT_STARTED`, `request.dryRun === true`, queued post, healthy exact account/profile, fresh readiness, no unresolved submission, and dry-run queue eligibility. It does not inspect or consume live grants/windows.

The server activates this lane only when `SEEDING_JEV_DRY_RUN_AUTONOMOUS_ENABLED=true`, and only when no explicit live or dry-run execution ID is configured. Existing live autonomous and explicit-ID precedence remains unchanged. The worker uses the existing lease, adapter, receipt, and idempotency contracts.

Verification: focused readiness/execution suite passed 47/47. No ORCA, browser, network, social, canonical runtime, or UNKNOWN execution was touched.
