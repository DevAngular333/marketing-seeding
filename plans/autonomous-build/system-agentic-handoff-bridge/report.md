# Versioned System-Agentic → marketing-seeding handoff bridge

## Result

**PASS (local / synthetic only).** A versioned `SYSTEM_AGENTIC_AI` envelope can
now be consumed by the existing marketing-seeding distribution handoff seam.
The bridge validates the outer contract, preserves the canonical inner
ProductRun/ProductArtifact/MediaArtifact/ContentVariant/ContentPackage/
DistributionIntent contract, and delegates persistence to
`SeedingService.attachDistributionHandoff()`.

This is an integration seam proof. It is not live upstream runtime wiring,
live authorization, browser execution, LinkedIn publication or publication
verification.

## Implemented

- `src/system-agentic-handoff-bridge.mjs`
  - bridge version `1`;
  - source identity `SYSTEM_AGENTIC_AI`;
  - UTC emission timestamp;
  - explicit `DRY_RUN` envelope and payload modes;
  - stable envelope hash with key-order-independent identity;
  - campaign binding between route, envelope and payload;
  - bounded JSON and recursive credential/browser/execution-detail rejection;
  - consumer delegation to the existing `SeedingService` handoff method.
- `src/server.mjs`
  - existing POST distribution-handoff route accepts the wrapped envelope;
  - raw canonical DRY_RUN payloads remain compatible;
  - route campaign ID is checked against the envelope before persistence.
- `src/distribution-handoff.mjs`
  - sanitized source provenance now preserves bridge system/version/hash/time;
  - invalid source provenance fails closed before persistence.

## Safety proof

The fixture consumer persisted one sanitized campaign handoff row and created
zero posts, execution requests, one-time windows, live grants, execution
leases, publication attempts or submission uncertainties. Replaying the exact
envelope through a new `JsonStore` instance retained one row and did not
dispatch. `LIVE`, unsupported versions, invalid timestamps, hash mismatch,
route campaign mismatch, forbidden fields and malformed canonical references
all failed before a write.

The downstream validator remains authoritative for exact campaign/content/
media/target identity and integrity. The bridge derives no authority and does
not touch JEV, ORCA, LinkedIn, browser state or external platforms.

## Evidence class and limits

- Evidence: `LOCAL_REAL` isolated temporary stores plus `SYNTHETIC` producer
  envelopes and HTTP fixture server.
- No network, credential, browser, ORCA, LinkedIn or social action occurred.
- No upstream System-Agentic process emitted an envelope in this milestone;
  the producer is represented by a deterministic fixture constructor.
- The HTTP bearer role authenticates the local route, but no cross-process
  signature or secure capability exchange is claimed by this bridge.
- Canonical production state and historical UNKNOWN execution records were not
  used for writes.

## Verification commands

```text
node --test test/system-agentic-handoff-bridge.test.mjs test/distribution-handoff.test.mjs test/server.test.mjs
14 passed, 0 failed, 0 skipped

npm test
461 total, 459 passed, 0 failed, 2 skipped

node --check src/*.mjs
git diff --check
PASS
```

The existing `FixtureWorkerBridge` guard logs an expected rejected non-fixture
domain during the full suite; its test passes and no external request is made.

## Verdict

The downstream integration seam is locally verified and safe to reuse. The
next live handoff milestone still requires an authorized upstream producer,
fresh exact campaign authority and the already blocked browser/LinkedIn lane.
