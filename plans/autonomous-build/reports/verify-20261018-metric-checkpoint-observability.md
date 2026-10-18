# Independent review — metric checkpoint observability

**Reviewer:** read-only independent verification  
**Result:** `ACCEPT_BOUNDED`

## Findings

- `buildMetricCheckpoints` reuses the existing service/dashboard read model and
  adds no store, scheduler, provider router, authority, browser, or execution
  path.
- Checkpoints are bounded to `1h`, `24h`, and `72h` from a valid `publishedAt`.
- Evidence is filtered to `[checkpoint dueAt, next checkpoint dueAt)`, sorted by
  timestamp, kind, and ID, and the latest qualifying event wins. This allows a
  later observed snapshot to reconcile an earlier unknown run without allowing
  it to satisfy a later checkpoint.
- Pre-publication and future evidence are excluded. Invalid publication times
  fail closed to three `unknown` rows without due times.
- `unknown`/failed collector evidence remains `unknown`; `not_applicable` and
  unsupported evidence remains `unsupported`; a successful collector run alone
  does not imply a metric snapshot.
- Existing `nextReviewAt`, priority, delta, authority, browser, publication,
  and UNKNOWN behavior remains compatible.

## Verification

- Focused service tests: **59 passed, 0 failed, 0 skipped**.
- Full Node suite: **435 total, 433 passed, 0 failed, 2 skipped**.
- Source syntax and `git diff --check`: **PASS**.
- Canonical runtime schema 8 revision 194 SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`
  remained unchanged.
- No browser, ORCA, credential, external network, publication, social, or
  historical UNKNOWN mutation occurred.

## Residual

The projection is observability only. It does not prove exact-time collection or
live provider behavior. A failed collector run maps to `unknown` deliberately
and remains distinguishable through its persisted run reference and reason.
