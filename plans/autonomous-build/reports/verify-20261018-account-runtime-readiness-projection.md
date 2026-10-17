# Independent Verification — Account Runtime Readiness Projection

**Baseline:** `682c749` (pinned in milestone)  
**Reviewed:** integration working tree on `integration/autonomous-build`  
**Verdict:** PASS (bounded)

## Unverified first

- No authenticated browser profile, network, credentials, canonical runtime state, or social platform was accessed.
- Live session reuse, login, recovery, account selection/failover and multi-account execution remain unverified.
- I did not rerun the complete `node --test test/*.test.mjs` suite in this review; the milestone artifact records 374 total, 372 passed, 0 failed, 2 skipped and should be confirmed by the integration owner after final integration.
- Canonical runtime SHA/revision and protected UNKNOWN IDs were not re-read in this review; no path used by this change opens or writes them.

## Scope and evidence

The working-tree change is limited to `src/service.mjs`, `test/account-runtime-projection.test.mjs`, and the milestone journal. The source extends the existing pure `projectExecutionAccountRuntime` transformation. It adds fixed descriptive `sessionMode`/`authMode`, exact target binding count, fail-closed `eligibleForExecution`, and ordered `ineligibilityReasons`. The dashboard returns this projection under both existing `accountRuntime` and `executionAccounts` fields.

No changes were found in LinkedIn/JEV/ORCA, browser transport, authorization, grants, execution windows, leases, submit intent, publication verification, or UNKNOWN quarantine paths.

## Acceptance table

| ID | Result | Evidence |
|---|---|---|
| A1 | PASS | Projection exposes bounded session/auth labels, eligibility boolean and deterministic reason array. |
| A2 | PASS | Eligibility reads only account status/health, exact platform/account/profile target bindings and newest bound readiness. No login, selection, recovery, dispatch or browser call is introduced. |
| A3 | PASS | Projection allowlist retains profile fingerprint only; tests assert no profile ID, identity URL, evidence or secret token. |
| A4 | PASS | Disabled/unhealthy/missing binding/missing or expired readiness and non-READY readiness produce explicit ineligibility. HUMAN_REQUIRED and UNKNOWN health remain ineligible. |
| A5 | PASS (bounded) | Account rows sort by stable ID; dashboard reads do not mutate state; restart equality and no-side-effect tests pass. |
| C1 | PASS | Existing `projectExecutionAccountRuntime` and `SeedingService.dashboard()` are reused. |
| C2 | PASS | Static changed-file review found no execution/governance/browser/UNKNOWN semantic edits. |
| C3 | PASS | Tests use temporary local stores only; no browser, network, credential or canonical state access. |
| C4 | PASS | Synthetic fixtures only; no external side effect. |
| V1 | PASS | `node --test test/account-runtime-projection.test.mjs`: 5 passed, 0 failed, 0 skipped. |
| V2 | RECORDED / PENDING FINAL CONFIRMATION | Milestone artifact records full suite 374/372/0/2; not rerun in this independent pass. |
| V3 | PASS | `node --check src/service.mjs`, `node --check test/account-runtime-projection.test.mjs`, and `git diff --check` pass. |
| V4 | PASS | Read-only review confirms allowlist, fail-closed reasons, deterministic projection and no authority/execution changes. |
| V5 | PASS (bounded) | No source path in this diff touches canonical runtime or historical UNKNOWN records; live state was not opened. |

## Commands

```text
node --test test/account-runtime-projection.test.mjs
# 5 passed, 0 failed, 0 skipped
node --test test/account-runtime-projection.test.mjs test/service.test.mjs test/server.test.mjs
# 34 passed, 0 failed, 0 skipped
node --check src/service.mjs
node --check test/account-runtime-projection.test.mjs
git diff --check
```

## Findings

- `readinessExpired` is intentionally evaluated against current time, so eligibility is a live read-model property rather than persisted authority.
- Exact target matching includes channel, account ID and profile ID; a missing or mismatched binding cannot become eligible.
- The projection is observability only. `eligibleForExecution` is not consumed as a grant, dispatch permission or account selector by this change.

Status: PASS (bounded)
