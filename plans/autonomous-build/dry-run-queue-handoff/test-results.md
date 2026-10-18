# Test results

Date: 2026-10-18

| Gate | Command | Result |
|---|---|---|
| Rehearsal handoff | `node --test test/service.test.mjs --test-name-pattern='rehearsal handoff'` | 64 passed, 0 failed, 0 skipped |
| Readiness/JEV | `node --test test/readiness-execution.test.mjs test/jev-execution-worker.test.mjs` | 76 passed, 0 failed, 0 skipped |
| Full suite | `npm test` | 449 total, 447 passed, 0 failed, 2 skipped |
| Syntax | `node --check src/server.mjs`, `node --check src/service.mjs`, `node --check test/service.test.mjs` | passed |
| Diff hygiene | `git diff --check` | passed |

The two skipped tests are the existing runtime ACL and browser-evidence group
permission checks. The suite emitted one expected fixture-domain guard log;
the corresponding test passed and no browser or network action occurred.
