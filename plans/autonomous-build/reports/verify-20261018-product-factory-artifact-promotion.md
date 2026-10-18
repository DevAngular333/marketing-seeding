# Independent verification — Product Factory artifact promotion

Date: 2026-10-18  
Baseline: `c98aed6`  
Worktree: `integration/autonomous-build`

## Unverified first

- Canonical runtime state, revision/hash, and protected UNKNOWN records were not opened or mutated.
- No full Node suite was run in this focused review; the requested Product Factory/service/server gate is the evidence below.
- No network, browser, ORCA, credential, social, or external-provider action was performed.

## Diff scope

Compared with `c98aed6`, the runtime diff is limited to:

- `src/service.mjs`: `promoteProductFactoryArtifact`, bounded metadata/path validation, exact run/candidate/source/hash checks, idempotent artifact persistence.
- `src/server.mjs`: operator-only promotion route and automation mutation deny-list entry.
- Regression tests in `test/product-factory-runtime.test.mjs` and `test/server.test.mjs`.

`src/product-factory.mjs` and execution/authority/provider/browser modules are unchanged by this seam.

## Verification evidence

- `node --test test/product-factory-runtime.test.mjs test/product-factory.test.mjs test/service.test.mjs test/server.test.mjs` — **72 passed, 0 failed, 0 skipped**.
  - Includes successful promotion, repeat/restart idempotency, stale source, unsafe path, hash mismatch, secret metadata, failed run, authority collection invariants, and operator HTTP boundary.
- `for f in src/*.mjs; do node --check "$f"; done` — passed.
- `git diff --check` — passed.

## Acceptance table

| Criterion | Result | Evidence |
|---|---|---|
| A1 exact run/campaign/path/hash/success binding | PASS | Service re-reads campaign, run ID, successful status, repository path, candidate path and candidate SHA-256 before and inside mutation. **FACT** |
| A2 source containment and drift rejection | PASS | `normalizedRelativeArtifactPath` rejects absolute/traversal paths; `readArtifactSource` rehashes inside productRepo; stale/hash/candidate/conflict rejection tests pass. **FACT** |
| A3 bounded safe metadata/provenance | PASS | Name/mediaType/evidence are bounded and secret-filtered; persisted provenance is `{ factoryRunId, commandRef }`; no raw artifact bytes are returned or stored. **FACT** |
| A4 restart-safe idempotency | PASS | Same campaign/path/hash identity reuses the existing row only when provenance and metadata match; runtime test repeats before and after restart. **FACT** |
| A5 artifact-only side effects | PASS | Runtime test asserts posts, execution requests, grants and windows unchanged; promotion writes only `state.artifacts`. **FACT** |
| C1 existing service/store/source/schema/operator boundary | PASS | Uses `SeedingService`, `JsonStore.mutate`, `readArtifactSource`, persisted Product Factory lineage and operator bearer route. **FACT** |
| C2 strict factory execution preserved | PASS | No Product Factory runner changes; existing product-factory tests pass. **FACT** |
| C3 secret/raw-content safety | PASS (bounded) | Secret-like metadata rejected; artifact row stores path/hash/bytes, not content. Existing secret-redaction tests and promotion rejection pass. **FACT** |
| C4 no LinkedIn/JEV/ORCA/browser/social/UNKNOWN mutation | PASS | Diff contains no such modules or paths; side-effect assertions and focused service/server tests pass. **FACT** |
| V1 focused promotion/service tests | PASS | 72/72. |
| V2 full-suite regression | UNKNOWN | Not run in this focused review. |
| V3 syntax/diff checks | PASS | All source modules parse; diff check passes. |
| V4 independent lineage/authority/secret review | PASS (bounded) | Read-only diff review plus focused tests found no authority or UNKNOWN path changes. |
| V5 canonical/protected UNKNOWN snapshot | UNKNOWN | Canonical runtime was intentionally not accessed. |

## FACT / INFERENCE / UNKNOWN

- **FACT:** Promotion requires a `SUCCEEDED` run with `externalSideEffects === false`, matching campaign repository paths, exact persisted candidate path/hash, and current source hash.
- **FACT:** The mutation repeats all critical run/repository/candidate checks after rereading state, then performs one idempotent artifact write.
- **FACT:** HTTP promotion rejects unauthenticated and automation roles with 401; operator reaches the service and repeated requests reuse the same ID.
- **FACT:** No posts, execution requests, grants, windows, leases, publication evidence or UNKNOWN rows are created by the promotion test.
- **INFERENCE:** The route's explicit `automationCanMutate` false branch is defense-in-depth; the route-level role check is the effective operator gate.
- **UNKNOWN:** Full-suite result and canonical runtime/protected UNKNOWN snapshot.

## Verdict

**PASS (bounded)** — exact artifact promotion, source/hash binding, idempotency, operator boundary and artifact-only side effects are regression-backed. Full-suite and canonical runtime checks remain outside this focused review.

Status: PASS (bounded)
