# Test Results

| Gate | Result |
|---|---|
| `npm test` | 424 total, 422 passed, 0 failed, 2 skipped; exit 0 |
| Independent focused Product Factory/service/server gate | 72 passed, 0 failed, 0 skipped |
| `for f in src/*.mjs; do node --check "$f"; done` | PASS |
| `git diff --check` | PASS |
| Canonical read-only snapshot | schema 8, revision 194, SHA-256 unchanged at `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` |
| Protected historical UNKNOWN | Four executions and four uncertainty records present; no mutation/retry |

The two full-suite skips are existing host ACL checks. Tests used local temporary fixtures; no canonical state was used for writes.
