# Task — BUILD · deterministic outcome summary and advisory feedback

## Identity

Run: outcome-foundation-20261017 · Role: BUILD · Controller: /root  
Independent verifier: /root/integration_review (read-only)  
Workspace: `/Users/nam/Documents/marketing-seeding-outcome`  
Work dir: `plans/autonomous-build/outcome-foundation`

## Acceptance IDs

A1-A6; C1-C4; V1-V4.

## Allowed to change

- New bounded outcome module under `src/`.
- Minimal additive `SeedingService` method and dashboard projection.
- Minimal additive strategy integration only if advisory and no execution side effect.
- New focused tests under `test/`.
- `plans/autonomous-build/reports/outcome-foundation-worker.md`.

## Read-only paths

All LinkedIn/JEV/ORCA, authorization/grant/window/lease/execution/UNKNOWN modules,
store schema/migrations, canonical runtime, System-Agentic files and dashboard UI.

## Objective

Implement a deterministic campaign outcome summary over already persisted state.
Use only existing publication status/receipts/verification evidence, metric
snapshots, interactions, replies, conversions and keyword snapshots. Preserve
unknown coverage. Persist a bounded summary/history through the existing store
and expose it read-only. If strategy integration is added, it may add evidence
or reasons only and must remain advisory.

## Forbidden

No network, browser, ORCA/JEV/provider calls, credentials, social mutation,
post creation, approval, authority/grant/window/lease/execution mutation,
schema migration, LLM/provider dependency or new store/router/state machine.

## Routing

ROLE: BUILD · TIER: workhorse · EFFORT: high · REASON: bounded local feedback
slice reusing existing metrics and advisory strategy contracts.

## Verification

Run focused outcome/strategy/service tests, full Node suite if feasible,
`node --check src/*.mjs` and `git diff --check`. Report unknown and unverified
items before claims. Stop on CONTRACT_CHANGE_REQUIRED.
