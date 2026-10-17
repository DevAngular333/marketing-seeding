# Account Runtime Mission Control

**Status:** DONE_WITH_CONCERNS

## FACT

Mission Control now renders the existing account runtime projection as a read-only section. It displays bounded account id/platform, `SESSION_REUSE`, `MANUAL_AUTH`, eligibility, blocker and joined ineligibility reasons. Missing arrays render an empty `UNKNOWN` state. No controls, links, forms or mutation handlers were added.

## INFERENCE

The section improves operator observability and steering while preserving the existing dashboard fetch and account runtime contract.

## ASSUMPTION

`data.accountRuntime` is the canonical dashboard projection; `executionAccounts` is retained only as a compatibility fallback.

## UNKNOWN

Live session validity, login/recovery, selection/failover and external execution remain unverified.

## Acceptance

- A1-A4: PASS locally.
- C1-C3: PASS; existing dashboard data and read-only rendering reused.
- V1: PASS (`npx tsc --noEmit`).
- V2: PASS (`npm run build`).
- V3: PASS by source review; no action or mutation path.
- V4: Existing Node suite remains an integration-owner gate.

## Evidence

- `ui/src/App.tsx`
- `ui/src/index.css`
- `plans/autonomous-build/account-runtime-mission-control/test-results.md`

Status: DONE_WITH_CONCERNS
