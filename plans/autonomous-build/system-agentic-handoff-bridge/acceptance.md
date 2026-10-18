# Versioned System-Agentic handoff bridge

## Requirements

- **A1** Accept one versioned provider-neutral envelope from the upstream
  System-Agentic boundary and unwrap its canonical ProductRun/ProductArtifact/
  MediaArtifact/ContentVariant/ContentPackage/DistributionIntent payload.
- **A2** Require an explicit bridge version, source identity, timestamp and
  `DRY_RUN` mode; reject unsupported versions, malformed envelopes and LIVE
  envelopes before the downstream service is called.
- **A3** Reuse `SeedingService.attachDistributionHandoff()` as the only
  consumer persistence seam. Do not add a store, router, state machine,
  publisher or authority derivation path.
- **A4** Preserve exact downstream identity, integrity, bounded-input and
  forbidden execution/credential checks. Persist only the downstream
  sanitized handoff row and stable hash.
- **A5** Replaying the same envelope after a service/store restart remains
  idempotent and does not create duplicate handoff rows or execution artifacts.
- **A6** The HTTP handoff route accepts the versioned envelope while retaining
  compatibility with the existing raw canonical DRY_RUN payload shape.

## Constraints

- **C1** SYSTEM_AGENTIC_AI Core remains untouched and production-frozen.
- **C2** This milestone is fixture/local only: no network, browser, ORCA,
  credential, LinkedIn or social action.
- **C3** No canonical production state or historical UNKNOWN execution is
  mutated.
- **C4** LIVE mode fails closed; the bridge may never derive authority,
  execution windows, grants, leases or publication evidence.
- **C5** The existing downstream handoff validator and `JsonStore` remain the
  source of truth for validation and persistence.

## Verification

- **V1** Focused bridge tests cover valid envelope acceptance, source/version/
  timestamp/mode rejection, malformed canonical payload rejection and exact
  downstream error propagation.
- **V2** Restart replay proves one persisted handoff row, zero posts, requests,
  windows, grants, leases and publication attempts, and no live dispatch.
- **V3** HTTP route tests cover wrapped envelope and raw canonical compatibility.
- **V4** Full Node suite passes with zero failures; syntax and diff checks pass.
- **V5** Journal records local/synthetic evidence and remaining live handoff,
  browser and publication gaps.
