# Regression results

## Existing suite

Command:

```sh
cd /Users/nam/Documents/marketing-seeding-integration
npm test
```

Result: **538 tests, 536 passed, 0 failed, 2 skipped; process terminated normally.**

Covered existing regressions include command completion versus activation, activation versus acceptance, verified publication contracts, stale/moving/covered/wrong-composer controls, wrong account/profile, timeout/UNKNOWN quarantine, duplicate dispatch prevention, historical UNKNOWN immutability, one-click semantics, exact grants/windows, readiness and JEV lifecycle.

## Runtime diagnostics

- Canonical runtime snapshot: schema 8, revision 194, SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
- Focused transport/LinkedIn/JEV/authority/recovery gate: 154 passed, 0 failed, 0 skipped. Selector/authority/readiness/LinkedIn gate: 75 passed, 0 failed, 0 skipped.
- No external side effect or final Post click was issued in this milestone.
