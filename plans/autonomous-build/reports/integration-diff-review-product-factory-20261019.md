# Integration diff review — Product Factory/UI

**Reviewer:** read-only Product Factory gap worker
**Date:** 2026-10-19
**Branch:** `integration/autonomous-build`

## Verdict

**ACCEPT (bounded), with journal reconciliation required before release.**

## Scope reviewed

- `src/product-factory.mjs` Product Factory evidence projection
- `src/service.mjs` dashboard wiring for Product Factory and account projections
- `ui/src/App.tsx` read-only Product Evidence panel
- Product Factory/product-intelligence tests and current journal snapshots

## Safety findings

- `projectFactoryRunEvidence()` returns bounded, allowlisted metadata only: IDs, status, classification, plan/execution status, artifact relative path/hash/size, and bounded command references.
- Command output is not projected. Secret-like metadata is redacted. Hashes are accepted only in the expected 64-hex format.
- Projection does not execute commands, alter sandbox eligibility, promote artifacts, create authority, or touch canonical runtime/browser state.
- UI `ProductEvidencePanel` consumes existing read-only dashboard projections and explicitly labels evidence as read-only. It does not add approval or execution controls.
- Product Factory remains fail-closed for arbitrary build/render: unsupported sandbox checks keep `executionEligible: false` and unsafe commands `NOT_EXECUTED_UNSAFE`.
- Engagement and learning changes strengthen fail-closed semantics (invalid readiness expiry and post-level UNKNOWN dominance); focused regressions are present.

## Verification

`npm test` → **490 total, 488 passed, 0 failed, 2 skipped**, exit 0.

`ui/npm run build` → passed; existing Vite config-loader warnings only.

`git diff --check` → passed.

No browser, ORCA, LinkedIn, network, credentials, social mutation, or canonical state write was performed.

## Required rework before release

The source/UI changes are safe to accept, but journal latest-count fields are stale:

- `plans/autonomous-build/integration-ledger.json` entries `browser_transport_full_node_suite_latest` and `full_node_suite_latest` still say 486 tests / 484 passed.
- `plans/browser-interaction-transport-certification/live-evidence.json` and related snapshots may still carry 488/486 as latest, while this gate is 490/488.

Reconcile these as current versus historical evidence without rewriting dated milestone records. Preserve the deployment boundary and live-proof blockers.

## Product Factory blocker remains open

`PRODUCT-FACTORY-SANDBOX-001` remains a genuine external hard blocker for arbitrary repository build/run/render/media execution. Existing local syntax/static evidence and artifact hashing are valid bounded proof; they do not prove project-specific artifact generation.
