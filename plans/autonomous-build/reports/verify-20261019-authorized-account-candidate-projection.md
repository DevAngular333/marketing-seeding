# Independent Verification — Authorized Account Candidate Projection

**Milestone:** `authorized-account-candidate-projection`
**Acceptance:** `plans/autonomous-build/authorized-account-candidate-projection/acceptance.md`
**Reviewer:** read-only independent verifier
**Date:** 2026-10-19 (Asia/Ho_Chi_Minh)
**HEAD:** `4115a732f758985c2b39ccbfab3748d57d9f3c00`

## Commands and results

- `node --test test/authorized-account-candidate-projection.test.mjs test/account-runtime-projection.test.mjs test/readiness-execution.test.mjs` → **55 passed, 0 failed, 0 skipped**.
- `node --check src/service.mjs` → **PASS**.
- `npm test` → **472 total, 470 passed, 0 failed, 2 skipped**.
- `git diff --check` → **PASS**.

No browser, ORCA, LinkedIn, network, credential, canonical runtime, social mutation, retry or UNKNOWN-record mutation was performed.

## Diff and implementation review

The working-tree change is scoped to `src/service.mjs` plus the focused regression test. It adds the exported pure `projectAuthorizedAccountCandidates` projection and wires it into the existing read-only `SeedingService.dashboard()` projection as `authorizedAccountCandidates`. No store, state machine, browser abstraction, provider router, credential broker, account recovery, queue dispatch, worker, grant/window/lease, request or publication path was added.

The projection iterates campaign authorizations and their exact destinations, resolves the existing target and execution account, validates campaign status/scope fingerprint, authorization status/execution mode/live flag/binding/validity, exact platform/account/profile/URL and active target, then checks readiness state, binding, expiry and freshness. It also requires an enabled, healthy bound account. Every failure is represented by deterministic bounded reason codes and eligibility is fail-closed.

Ordering is deterministic: authorizations and destinations are sorted, then candidates are sorted by eligibility, platform, target ID and stable hash key; output is capped at 128 and receives deterministic `selectionOrder`. The key hashes campaign/authorization/platform/account/profile/target identity. The projection never rewrites bindings or selects another account/profile.

The output allowlist includes campaign/authorization references, platform/account ID, target ID/URL, profile fingerprint, session/auth mode labels, bounded readiness fields, eligibility and reason codes. It excludes raw `profileId`, readiness evidence, account secret-like fields, cookies, tokens and other session material. The focused test explicitly asserts those exclusions.

The dashboard test verifies restart-stable output and unchanged snapshots with zero execution requests, windows, grants or leases. Existing readiness/JEV/LinkedIn regression coverage remains green. The implementation docstring states eligibility is advisory pre-dispatch data and that queue/worker revalidate the full execution contract; it does not imply publication readiness or platform support.

## Runtime safety evidence

Direct canonical state read-only check before/after tests:

- State path: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`
- Schema: `8`
- Revision: `194`
- SHA-256: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`
- Requests: `8`
- Submission uncertainties: `4` (protected historical UNKNOWN set unchanged)
- Published posts: `0`
- Active authorizations/windows/grants/leases: `0`

The implementation uses an injected fixed `now` in tests and the service readiness TTL, so candidate output is deterministic for a fixed clock and remains read-only across restart.

## Acceptance mapping

- **A1:** PASS — exact existing campaign authorization, destination, target, account and readiness bindings are used.
- **A2:** PASS — active/valid standing authorization, campaign scope, exact target/account/profile, enabled/healthy account and fresh bound readiness are all required; failures are deterministic.
- **A3:** PASS — stable hash key, deterministic ordering and selection order; no rebinding or alternate-profile selection.
- **A4:** PASS (bounded) — dashboard read model only, cap 128, fingerprint/allowlist sanitization, no raw evidence or credential/session material.
- **A5:** PASS — no queue/worker/submit semantics changed; pre-dispatch advisory boundary is explicit.
- **C1–C5:** PASS — existing contracts reused; no new store/router/browser/credential/recovery path; local fixtures only; no canonical/UNKNOWN mutation or secret persistence.
- **V1:** PASS — focused candidate projection tests 3/3 pass.
- **V2:** PASS (bounded) — account/readiness/JEV/LinkedIn focused gate 55/55 and full suite 470/470 pass with 2 existing skips.
- **V3:** PASS — fixed-clock deterministic output, restart-safe dashboard projection, bounded 128 output, secret-safe tests.
- **V4:** PASS — canonical revision/SHA and protected UNKNOWN records unchanged; no published posts.
- **V5:** PASS — independent diff review and final focused rerun completed.

## Remaining bounded limitation

This projection is local/read-only evidence. It does not authenticate, select/fail over accounts, create authority, perform browser execution, prove live readiness, or certify external publication. Canonical service deployment is a separate release concern.

**Verdict: PASS (bounded)**
