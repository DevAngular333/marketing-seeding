# System Agentic handoff compatibility worker report

## Unverified first

- No live upstream System-Agentic producer, browser, provider, network, credential, social mutation or publication was used.
- Canonical runtime revision/hash and protected UNKNOWN IDs were not accessed from this isolated worker checkout; those remain integrator-owned V4 evidence.
- The compatibility path accepts one exact campaign-bound content variant and its declared media references per handoff.

## Outcome

Added a narrow canonical envelope adapter in `src/distribution-handoff.mjs`. It recognizes `ProductRun`, `ProductArtifact`, `MediaArtifact`, `ContentVariant`, `ContentPackage`, and `DistributionIntent` records, checks bounded JSON, product identity, exact references, duplicate/unresolved refs, media SHA-256 evidence, and then normalizes into the existing campaign-owned DRY_RUN validator. Existing flat handoffs remain compatible.

The existing service persistence path remains authoritative and idempotent. Sanitized output stores only campaign/product/content identity hashes, media artifact IDs and hashes, target ID, source metadata, and the stable handoff hash. No content candidate, post, authorization, grant, window, lease, execution request, publication attempt, browser call, quota usage or external side effect is created.

## Acceptance table

| ID | Result | Evidence |
|---|---|---|
| A1 | PASS | Canonical six-record envelope maps through existing `attachDistributionHandoff` seam. |
| A2 | PASS | Product/reference checks, campaign-bound content SHA-256, media SHA-256, bounded JSON, forbidden recursive field scan, and LIVE rejection. |
| A3 | PASS | Existing `JsonStore` campaign handoff row is reused and duplicate handoff hashes are idempotent. |
| A4 | PASS | Normalized persisted row excludes raw canonical records and retains only allowlisted IDs, hashes and metadata. |
| A5 | PASS | Focused tests assert unchanged posts/execution requests and DRY_RUN result flags. |
| C1-C5 | PASS | Only allowed source/test/report paths changed; no upstream core, browser, provider, authorization or UNKNOWN code touched. |
| V1 | PASS | Canonical acceptance, identity/integrity rejection, forbidden internals, duplicate/unresolved refs, oversized field, idempotency and no-side-effect tests. |
| V2 | PASS | `node --test test/*.test.mjs`: 369 total, 367 passed, 0 failed, 2 skipped; syntax and diff checks passed. |
| V3 | PENDING | Independent read-only review and focused rerun are integrator-owned. |
| V4 | PENDING | Canonical runtime/protected UNKNOWN comparison is integrator-owned. |

## Evidence and confidence

- Focused: `node --test test/distribution-handoff.test.mjs` — 7 passed, 0 failed; canonical fixtures now satisfy required ProductRun/ProductArtifact/MediaArtifact/ContentVariant/ContentPackage/DistributionIntent fields and malformed-field rejection is covered.
- Regression: `node --test test/distribution-handoff.test.mjs test/service.test.mjs test/server.test.mjs` — 35 passed, 0 failed.
- Static: `node --check src/distribution-handoff.mjs`; `git diff --check` — passed.
- Confidence: high for local validation, normalization, persistence and side-effect fence; bounded for live/canonical state because none was accessed.

## Out of scope

Live handoff, provider dispatch, browser automation, credential/session handling, campaign authorization derivation, content generation, migration, canonical runtime writes and social actions.

Status: DONE_WITH_CONCERNS
