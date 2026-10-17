# Independent Product Lineage Verification — 2026-10-17

Baseline reviewed: `4e5b7d2` (`docs: finalize autonomous build release ledger`).
Scope: read-only review of the current working-tree diff plus the product-lineage source and tests. No source/test edits, browser action, network access, or live publication was performed.

## Commands rerun

- `node --test test/product-repository-inspection.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs`: **34 passed, 0 failed, 0 skipped**.
- `node --test test/product-intelligence.test.mjs test/product-intelligence-runtime.test.mjs test/product-factory.test.mjs`: **13 passed, 0 failed, 0 skipped**.
- `for f in src/*.mjs; do node --check "$f" || exit 1; done`: **passed**.
- `git diff --check`: **passed**.

The requested `reports/factory-lineage-worker.md` was not present. The available factory reports were `plans/autonomous-build/reports/product-factory-runtime.md` and `plans/autonomous-build/reports/product-factory.md`; their older `persisted: false` wording is stale relative to the current implementation and tests.

## Acceptance table

| ID | Result | Evidence / limitation |
|---|---|---|
| A1 | PASS (bounded) | `src/product-repository-inspection.mjs:38-76` uses resolved repository root, explicit allowlist, regular-file checks, size limits, and symlink escape rejection. An absolute allowlist string is normalized by stripping leading `/` at line 44, so it is treated as a repository-relative name rather than reported as `invalid_path`; it does not escape the root. |
| A2 | PASS (bounded) | `inspectProductIntelligence` feeds only scanner records into `buildProductIntelligence`; unsupported claims remain quarantined. Persisted inspection summaries omit file content (`src/product-repository-inspection.mjs:79-110`). |
| A3 | PASS | `SeedingService.inspectProductIntelligence` persists the versioned handoff and inspection metadata; `dashboard()` projects both read-only (`src/service.mjs:599-628,1156-1168,3494-3500`). Route is additive at `src/server.mjs:517-520`. |
| A4 | PASS | Factory runs persist classification, plan, execution, artifact hashes, repository identity, actor, status and timestamps; history is capped at 24 (`src/service.mjs:539-597`). Restart and bounded-history tests pass. |
| A5 | **FAIL (bounded)** | Commands are shell-free and allowlisted with timeout/output bounds and redaction (`src/product-factory.mjs:45-79`). However Python plans run `python3 -m compileall -q .` (`src/product-factory.mjs:35-39`), which writes `__pycache__` files into the campaign repository. That is a local filesystem side effect and conflicts with the requirement that factory execution be external-side-effect-free. |
| A6 | PASS (static) | Product-lineage diff touches service factory/intelligence and one additive server route; no LinkedIn/JEV/ORCA source changed in this milestone diff. Existing execution semantics were not altered by the inspected files. |
| A7 | **FAIL (bounded)** | `collectArtifactEvidence` uses `path.resolve`, `fs.stat`, and `fs.readFile` without `realpath` containment (`src/product-factory.mjs:81-92`). An allowlisted symlink can therefore read/hash a file outside the campaign repository, contrary to the repository-only and no-protected-state boundary. |
| A8 | PASS (static) | No System-Agentic Core files appear in the milestone diff. |
| C1 | PASS | Existing `JsonStore`, `SeedingService`, handoff, factory runner, artifact evidence and dashboard are reused; no duplicate store/state machine added. |
| C2 | PASS for inspection; PARTIAL for artifacts | Inspection has explicit allowlist/size/redaction controls. Artifact collection lacks symlink-realpath containment as described under A7. |
| C3 | PASS | New route/fields are additive; existing factory response changes `persisted` to `true` as required by the lineage milestone. |
| C4 | PASS (static) | No external/browser/social operation was performed by verification; factory runner uses `shell:false` and no network API. |

## Security and persistence review

- **Path containment:** inspection worker resolves the root and rejects symlink escapes. Artifact collection is weaker: `path.resolve` containment alone does not prevent a symlink target outside the root.
- **Secrets:** inspection redacts credential-like lines and forbids credential-like filenames; product-intelligence normalization redacts secret-like keys/values; factory stdout/stderr is redacted. No new secret material was found in the diff. Test fixtures contain only non-production token/lease literals.
- **Persistence:** factory run records are append-only within a bounded 24-entry campaign history and survive a new `JsonStore` instance. Failed runs are recorded before the original error is rethrown. Product-intelligence persistence keeps content in the handoff document but stores repository inspection as metadata-only records.
- **Canonical state:** no canonical production state was opened or mutated. The pinned runtime record remains the only evidence available here (`plans/autonomous-build/pin/runtime-state.json`: schema 8, revision 193, SHA-256 `327688c03b5f535e4cc8082837a3cd338db74b74207b86887eef2ae9ed965aae`). Protected UNKNOWN IDs were not touched by this diff, but live immutability was not independently re-read.

## Untouched execution semantics

The milestone diff did not modify LinkedIn adapter, JEV worker, ORCA browser client, authorization, grant, one-time-window, lease, idempotency, or UNKNOWN modules. Static review found no route from product inspection/factory methods to publication or browser execution. No social mutation or live publication attempt occurred.

## Verdict

**Verdict: FAIL (bounded)**

The implementation is otherwise locally verified and the focused tests/syntax checks pass. Acceptance remains blocked by the Python `compileall` filesystem write and the artifact collector's symlink escape. Full-suite V5, canonical runtime SHA/revision re-read, and live/browser proof were not performed in this verification.
