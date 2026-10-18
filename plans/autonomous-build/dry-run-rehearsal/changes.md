# Changes

- `src/service.mjs`: added `readyDryRunExecutionRequests()`.
- `src/jev-execution-worker.mjs`: added `runReadyDryRunOnce()` using existing worker path.
- `src/server.mjs`: added opt-in scheduler branch and read-only health/dashboard `jevDryRun` runtime projection.
- `test/readiness-execution.test.mjs`: added autonomous rehearsal regression test.
