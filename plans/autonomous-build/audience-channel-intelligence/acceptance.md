# Audience and channel intelligence — Acceptance

## Requirements

- **A1** Extend the existing deterministic discovery pipeline to evaluate a
  caller-supplied audience and channel fit without network access or model
  calls.
- **A2** Preserve the existing normalized discovery shape, policy checks,
  deduplication and scoring behavior when no fit inputs are supplied.
- **A3** Make fit outcomes explicit and fail closed: MATCHED, MISMATCHED or
  UNKNOWN must never be treated as publication authority or platform support.
- **A4** Use only bounded, normalized text and explicit target locale/channel
  hints; do not infer unsupported audience facts from missing evidence.
- **A5** Persist fit metadata through the existing `recordDiscoveries` path and
  expose it through existing dashboard discovery projections without adding a
  store or state machine.
- **A6** Add regression tests for audience match, channel mismatch, locale
  mismatch, unknown evidence, deterministic output and no authority side
  effects.

## Constraints

- **C1** Reuse `src/discovery.mjs`, `SeedingService.recordDiscoveries`,
  `JsonStore` and current dashboard projections.
- **C2** Do not modify LinkedIn/JEV/ORCA, browser transport, authorization,
  grants, windows, leases, submit intent, publication verification or UNKNOWN
  submission semantics.
- **C3** No network, browser, credentials, session material, social mutation or
  external side effect.
- **C4** Keep existing caller-supplied discovery behavior backward compatible;
  the new fit inputs are optional and bounded.
- **C5** Fit metadata is advisory intelligence only and cannot create posts,
  approvals, execution requests or live authority.

## Verification

- **V1** Focused discovery and service tests pass with zero failures.
- **V2** Full Node suite passes with zero failures; skipped tests are reported.
- **V3** `node --check src/*.mjs` and `git diff --check` pass after the final
  change.
- **V4** Independent read-only review confirms no execution or authority path
  changed and the fit result is persisted only through existing discovery state.
- **V5** Canonical runtime and protected UNKNOWN records remain unchanged.

