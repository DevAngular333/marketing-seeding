# Regression results

## Existing suite

Command:

```sh
cd /Users/nam/Documents/marketing-seeding
node --test test/*.test.mjs
```

Result: **272 tests, 270 passed, 0 failed, 2 skipped; process terminated normally.**

Covered existing regressions include command completion versus activation, activation versus acceptance, verified publication contracts, stale/moving/covered/wrong-composer controls, wrong account/profile, timeout/UNKNOWN quarantine, duplicate dispatch prevention, historical UNKNOWN immutability, one-click semantics, exact grants/windows, readiness and JEV lifecycle.

## Runtime diagnostics

- `/health`: service healthy, PID 64620, source commit `b4fa42b…`, schema 8, revision 193.
- Canonical SHA before/after audit: `327688c03b5f535e4cc8082837a3cd338db74b74207b86887eef2ae9ed965aae`.
- No external side effect or final Post click was issued in this milestone.
