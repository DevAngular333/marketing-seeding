# Independent Product Lineage Verification — Attempt 2 — 2026-10-17

Baseline: `4e5b7d2`. This is a new verification report and does not overwrite the prior bounded FAIL report. Review was read-only; no source/test edits, browser action, network access, or live publication was performed.

## Commands and results

- `node --test test/product-repository-inspection.test.mjs test/product-factory.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs`: **41 passed, 0 failed, 0 skipped**.
- `for f in src/*.mjs; do node --check "$f" || exit 1; done`: **passed**.
- `git diff --check`: **passed**.

## Acceptance table

| ID | Result | Evidence |
|---|---|---|
| A1 | PASS (bounded) | Inspector resolves the repository root and checks regular files, size limits, containment and symlink targets in `src/product-repository-inspection.mjs:38-87`. Absolute paths, traversal components and forbidden names are excluded from the processing allowlist and emitted as `invalid_path`/`forbidden_path` skips at lines 44-61. |
| A2 | PASS | `src/service.mjs:599-628` builds intelligence only from inspector records and explicit claims. Unsupported claims remain quarantined by the existing builder; persisted inspection summaries contain hashes/metadata and no content. |
| A3 | PASS | Existing `JsonStore` campaign state stores the handoff and inspection summary; dashboard projection is additive at `src/service.mjs:1156-1168,3494-3500`. Read-only inspection route is `src/server.mjs:517-520`. |
| A4 | PASS | `runProductFactory` persists each success/failure lineage record, including repository identity, execution result, artifacts, hashes and timestamps, with a 24-run cap at `src/service.mjs:539-597`. Restart/bounded-history runtime tests pass. |
| A5 | PASS (bounded) | Repository classification and factory execution use `realpath` (`src/product-factory.mjs:17-20,58-65`); generated Python validation uses `python3 -B -c` and compiles source without cache writes (`src/product-factory.mjs:35-39`); commands remain argv-only, allowlisted, shell-free, timeout/output bounded and redacted (`src/product-factory.mjs:45-79`). |
| A6 | PASS (static) | Current milestone diff is limited to product factory/inspection, service persistence/dashboard, additive server routing and related tests. No LinkedIn, JEV, ORCA, authorization, grant, window, lease, idempotency or UNKNOWN source changed. |
| A7 | PASS (bounded) | Artifact collection resolves the repository and each artifact, rejects traversal and symlink escapes before reading (`src/product-factory.mjs:81-96`). No canonical runtime or browser/social state was opened or mutated. |
| A8 | PASS (static) | No SYSTEM_AGENTIC_AI Core files are in the product-lineage diff. |
| C1 | PASS | Existing `JsonStore`, `SeedingService`, product-intelligence handoff, factory runner and dashboard are reused. |
| C2 | PASS | Inspector allowlist, traversal/absolute/forbidden path rejection, byte limits, symlink checks and JSON/line secret redaction are covered by focused tests. |
| C3 | PASS | New inspection endpoint and dashboard fields are additive; factory lineage response now truthfully reports `persisted: true`. |
| C4 | PASS (static) | No live external side effect or publication attempt occurred. |

## Security and contract review

- **Path/security:** `classifyRepository`, `executeFactoryPlan`, and `collectArtifactEvidence` canonicalize repository/cwd/artifact paths through `realpath`; artifact symlink escapes are explicitly tested. Inspector rejects absolute/traversal/credential-like paths and redacts JSON credential keys such as `token`.
- **Persistence:** Factory history is append-only within 24 entries and restart-safe. Failed factory runs are persisted before the original error is rethrown. Inspection persistence keeps only bounded metadata in `repositoryInspection`.
- **Secrets:** No new secrets were found in the diff. Inspector redacts key/value credentials and factory output redacts token-like assignments. Test literals are synthetic.
- **Untouched LinkedIn/JEV/ORCA semantics:** Static changed-file review shows no edits to these modules; no route from inspection/factory methods invokes publication, browser interaction, JEV dispatch, or UNKNOWN reconciliation.

## Unverified items

- Full `node --test test/*.test.mjs` V5 was not rerun in this attempt.
- Canonical runtime SHA/revision and protected UNKNOWN IDs were not independently re-read from the live runtime; the pinned record remains the only evidence.
- No browser, network, social-platform, or live-publication proof was possible or attempted.
- The factory module still exposes a general allowlisted runner API; this review verified generated service plans and the focused command-boundary tests, not malicious behavior inside an allowed project command.

**Verdict: PASS (bounded)**
