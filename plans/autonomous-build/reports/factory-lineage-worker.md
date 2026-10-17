# Factory Lineage Integration Report

Acceptance IDs: A4, A5, A6; constraints C1, C2, C4; verification V2, V4.

## Result

The integrated `SeedingService.runProductFactory()` persists each successful or failed bounded run in the existing campaign store. The history is capped at 24 entries, survives a new `JsonStore` instance, includes repository identity, classification, plan, execution result, optional artifact hashes and timestamps, and always records `externalSideEffects: false`.

The runner remains shell-free, uses an explicit binary allowlist, bounds time/output, canonicalizes repository/cwd/artifact paths, rejects symlink escape and uses `python3 -B` for syntax validation without cache writes.

## Evidence

- `node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs`: included in the 41-test lineage gate, all passed.
- Complete suite: 324 total, 322 passed, 0 failed, 2 skipped.
- Independent verifier attempt 2: `plans/autonomous-build/reports/verify-product-lineage-20261017-attempt2.md`, PASS (bounded).

## Limit

This is durable run lineage, not a general build/render/media pipeline.

Status: DONE_WITH_CONCERNS
Summary: Existing factory safety behavior is now integrated with bounded persistent campaign-owned lineage.
Concerns/Blockers: Project-specific artifact generation and live platform proof remain out of scope.
