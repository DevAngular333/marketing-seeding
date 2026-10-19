# Changes

- `src/service.mjs`: add explicit terminal `dry_run_completed` and
  `dry_run_failed` timeline events; keep event references fingerprinted and fix
  `latestAction.executionRef` to use the already-safe projected reference.
- `ui/src/App.tsx` / `ui/src/index.css`: render the existing bounded timeline
  read-only; expose links only when publication status is `VERIFIED`.
- `test/service.test.mjs`: cover chronological redaction and explicit dry-run
  terminal evidence.

No authority, browser, transport, provider, canonical runtime or social path
was changed.
