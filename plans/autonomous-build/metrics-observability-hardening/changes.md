# Changes

- Added a closed metric coverage vocabulary in `src/service.mjs`.
- Explicit invalid coverage now rejects metric writes; omitted coverage still
  derives from value presence.
- Added one shared locale-independent deterministic snapshot comparator
  (capture time, then ID)
  for traffic pulse and dashboard latest metrics.
- Dashboard coverage buckets now normalize unknown persisted values to
  `measured`, `unknown`, or `unsupported`.
- Contradictory explicit coverage/value pairs fail closed, and dashboard
  totals include values only when normalized coverage is `measured`.
- Added service regressions for invalid coverage, tie ordering permutations,
  and dashboard bounded coverage.

No authority, browser, provider, dispatch, UNKNOWN, or canonical runtime code
was changed.
