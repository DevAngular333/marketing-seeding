# Test results

Date: 2026-10-18

| Gate | Command | Result |
|---|---|---|
| Restart/lease soak | `node --test test/dry-run-restart-soak.test.mjs` | 1 passed, 0 failed, 0 skipped |
| Focused dry-run/JEV/service gate | `node --test test/dry-run-restart-soak.test.mjs test/service.test.mjs test/readiness-execution.test.mjs test/jev-execution-worker.test.mjs` | 148 passed, 0 failed, 0 skipped |
| Source syntax | `node --check test/dry-run-restart-soak.test.mjs` plus all `src/*.mjs` | passed |
| Diff hygiene | `git diff --check` | passed |
| Full suite | `npm test` | 457 total, 455 passed, 0 failed, 2 skipped |

The isolated test uses only a temporary filesystem fixture and an in-memory
fixture adapter. It performs no browser, ORCA, network or social action.
