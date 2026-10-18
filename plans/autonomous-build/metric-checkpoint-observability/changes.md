# Changes

- Added `buildMetricCheckpoints` as a pure projection over existing posts,
  metric snapshots, and collector runs.
- Added fixed `1h`, `24h`, and `72h` checkpoint windows derived from valid
  `publishedAt` values.
- Added deterministic latest-evidence selection within each checkpoint
  interval, with explicit snapshot and collector-run references.
- Preserved `pending`, `due`, and `missing` timing states plus fail-closed
  `unknown` and `unsupported` evidence states.
- Exposed checkpoints through the existing traffic-pulse/dashboard shape.
- Added regressions for progression, interval isolation, pre-publication
  snapshots, unknown/unsupported runs, invalid timestamps, deterministic ties,
  and dashboard projection.
- No persistence schema, authority, execution, provider, browser, publication,
  retry, or canonical runtime behavior changed.
