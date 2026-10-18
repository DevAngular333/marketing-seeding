# Changes

- `src/service.mjs`: added `readyDryRunExecutionRequests()` with matching top-level and nested dry-run mode checks.
- `src/jev-execution-worker.mjs`: added `runReadyDryRunOnce()` using existing worker path.
- `src/server.mjs`: added opt-in scheduler branch and read-only health/dashboard `jevDryRun` runtime projection; dry-run-only cycles skip automatic UNKNOWN reconciliation while mixed live mode preserves live reconciliation.
- `test/readiness-execution.test.mjs`: added autonomous rehearsal regression coverage for mismatched mode flags.
- `.env.example` and `docs/JEV-LINKEDIN-EXECUTION.md`: document the opt-in lane and its no-reconciliation boundary.
