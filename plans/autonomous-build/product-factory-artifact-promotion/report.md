# Product Factory artifact promotion

## Outcome

Added an operator-only path that promotes one exact Product Factory candidate into the existing verified artifact collection. Promotion is bound to the persisted successful run, campaign repository, relative candidate path, recorded SHA-256, and current source bytes. Repeating the same request reuses the existing artifact, including after restart.

The feature reuses `SeedingService`, `JsonStore`, Product Factory lineage, `readArtifactSource`, and the existing artifact schema. It creates only an artifact row. It does not create authority, posts, execution requests, grants, one-time windows, leases, publication evidence, or browser actions. Factory runs remain local evidence with `externalSideEffects: false`; promotion does not claim that the artifact was published or independently verified on a platform.

## Files and architecture

- `src/service.mjs`: exact lineage/source/hash validation, secret-safe bounded metadata, conflict detection, and idempotent artifact persistence.
- `src/server.mjs`: operator-only `POST /api/campaigns/:campaignId/product-factory/artifacts/promote`; automation is denied.
- `test/product-factory-runtime.test.mjs`: successful promotion, side-effect invariants, restart idempotency and failure cases.
- `test/server.test.mjs`: unauthenticated/automation denial and operator success/idempotency.
- Independent review: `plans/autonomous-build/reports/verify-20261018-product-factory-artifact-promotion.md`.

## Verification evidence

- `npm test`: **424 total, 422 passed, 0 failed, 2 skipped**, exit 0.
- Focused Product Factory/runtime/service/server review: **72 passed, 0 failed, 0 skipped** (independent reviewer).
- `for f in src/*.mjs; do node --check "$f"; done`: passed.
- `git diff --check`: passed.
- Canonical runtime read-only SHA-256: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`; schema 8, revision 194, matching the prior snapshot.
- Four protected historical UNKNOWN execution IDs and their four UNKNOWN uncertainty records remain present; no mutation or retry occurred.
- No browser, ORCA, LinkedIn, network, credential, or social action was performed.

## How to use

Run an existing safe Product Factory evidence run, select an exact candidate, then call the promotion route with `factoryRunId`, relative `path`, candidate `sha256`, bounded `name`, `mediaType`, and evidence text using the operator bearer token. The route rejects stale source bytes and conflicting identity. Promotion remains an explicit operator action and does not create publication authority.

## Limitations

- Product Factory command execution remains restricted to the existing safe evidence allowlist; arbitrary build/render scripts are not executed.
- Artifact promotion currently requires an operator-triggered API request; scheduled auto-promotion is not implemented.
- This is LOCAL_REAL filesystem hash/source validation with synthetic test fixtures, not live website or publication evidence.
- Canonical state was read-only and not used for the promotion tests.

## Status

`COMPLETE_LOCAL_VERIFIED`; live LinkedIn publish and publication verification remain blocked by absent fresh exact authorization and unavailable ORCA runtime.
