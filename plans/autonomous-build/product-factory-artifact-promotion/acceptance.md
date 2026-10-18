# Product Factory artifact promotion — Acceptance

## Requirements

- **A1** Promote only one exact persisted Product Factory run artifact, bound
  to the requested campaign, run ID, relative path, candidate SHA-256 and
  successful run status.
- **A2** Re-read the current repository file inside the mutation boundary,
  enforce repository containment, and reject path escape, source drift, stale
  hash, missing candidate, failed/unsafe run, or conflicting identity.
- **A3** Require explicit operator-supplied name, media type and evidence;
  persist only bounded secret-safe metadata and provenance
  `{ factoryRunId, commandRef }`.
- **A4** Repeated promotion is restart-safe and idempotent: it reuses the
  exact existing artifact and never creates a duplicate row.
- **A5** Promotion creates only a verified `state.artifacts` row. It must not
  approve a campaign, create posts, requests, grants, windows, leases,
  browser actions, publication evidence, or mutate UNKNOWN history.

## Constraints

- **C1** Reuse `SeedingService`, `JsonStore`, `readArtifactSource`, the existing
  artifact schema, Product Factory run lineage and operator bearer boundary.
- **C2** Do not broaden Product Factory execution beyond the existing strict
  allowlist; do not run package managers, arbitrary scripts, renderers or
  network commands.
- **C3** No credentials, cookies, tokens, session material or raw artifact
  contents may enter state, logs, reports or API responses.
- **C4** No LinkedIn/JEV/ORCA/browser/social mutation and no historical
  UNKNOWN retry or mutation.

## Verification

- **V1** Product Factory/service promotion tests pass with zero failures,
  including success, idempotency, stale source, wrong candidate, unsafe path,
  failed run and side-effect invariants.
- **V2** Operator-only HTTP route rejects automation and unauthenticated
  callers and reaches the existing service for the operator.
- **V3** Full Node suite has zero new failures; source syntax and diff checks
  pass.
- **V4** Independent read-only review confirms exact lineage/hash binding,
  no authority/execution changes, no secret persistence and no UNKNOWN drift.
- **V5** Canonical runtime/protected UNKNOWN snapshot remains unchanged.

