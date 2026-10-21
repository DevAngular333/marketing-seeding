# Regression results

## Existing suite

Command:

```sh
cd /Users/nam/Documents/marketing-seeding
npm test
```

Result: **572 tests, 570 passed, 0 failed, 2 skipped; process terminated
normally.**

Covered regressions include command completion versus activation, activation
versus acceptance, verified publication contracts, stale/moving/covered/wrong-
composer controls, wrong account/profile, timeout/UNKNOWN quarantine,
duplicate dispatch prevention, historical UNKNOWN immutability, one-click
semantics, exact grants/windows, readiness and JEV lifecycle, and the renewed
pre-submit-only retry guard.

Focused gates remain green:

- transport/JEV/LinkedIn/authority/recovery: **154/154**;
- selector/authority/readiness/LinkedIn: **75/75**;
- renewal regression: **passed**.

## Fresh live execution diagnostics

- Execution `39e667ef-f564-4480-bdbb-0247f3213bd0` created from a fresh exact
  standing authorization and dispatched once.
- One durable submit intent was committed before the action.
- One autonomous ORCA accessibility final action (`e13`) returned
  `COMMAND_COMPLETED`.
- Semantic activation was `CONTROL_NOT_OBSERVED`; the composer stayed open and
  no LinkedIn acceptance evidence was observed.
- Read only reconciliation ran once and found no publication. No retry or
  second final click occurred.
- Canonical post/execution remain `submit_result_unknown`; historical UNKNOWN
  records remain immutable.

Synthetic and local regression tests are not live publication proof.
