# Metrics observability hardening

## Acceptance

- **A1** Metric coverage is restricted to `measured`, `unknown`, or
  `unsupported`; an invalid explicit status fails closed, while omitted
  coverage derives from whether a value is present.
- **A2** Traffic pulse latest and previous snapshots are selected
  deterministically by capture timestamp and stable snapshot identifier.
- **A3** Dashboard latest metrics use the same deterministic selection and
  cannot create arbitrary coverage buckets.
- **A4** Outcome summary semantics remain unchanged.
- **A5** The milestone has no browser, provider, authority, dispatch, social,
  or canonical runtime side effects.

## Constraints

- **C1** Modify only `src/service.mjs`, relevant tests, and this milestone's
  plan artifacts.
- **C2** Preserve existing metric values, provenance, UNKNOWN quarantine, and
  publication semantics.
- **C3** Do not add a store, schema, provider, transport, or state machine.

## Verification

- **V1** Focused service and outcome tests pass with zero failures.
- **V2** Regression tests cover invalid coverage and same-timestamp ordering
  permutations for traffic pulse and dashboard projections.
- **V3** Syntax and `git diff --check` pass.
