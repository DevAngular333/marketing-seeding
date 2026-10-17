# Strategy fit gate — Acceptance

## Requirements

- **A1** Advisory strategy must not select a discovery whose persisted audience, channel or locale fit is explicitly not eligible.
- **A2** A discovery with `fit.eligible === true` remains selectable when its existing status, relevance and policy checks pass.
- **A3** Legacy discovery records without a `fit` field remain compatible with the existing deterministic strategy contract.
- **A4** The gate remains advisory only: it must not create posts, authority, windows, grants, leases, execution requests, browser calls or publication evidence.
- **A5** UNKNOWN quarantine and existing strategy ordering remain unchanged.

## Constraints

- **C1** Reuse `src/strategy.mjs`, existing discovery records and `SeedingService.deriveStrategy()`.
- **C2** Do not add a selector, provider router, store, state machine or new authority path.
- **C3** Do not access network, browser profiles, credentials or canonical runtime state.

## Verification

- **V1** Focused strategy tests pass with zero failures.
- **V2** Full Node suite passes with zero failures; skipped tests are reported.
- **V3** Syntax and diff checks pass.
- **V4** Read-only review confirms mismatch/unknown fit cannot become an actionable advisory candidate and no execution semantics changed.
