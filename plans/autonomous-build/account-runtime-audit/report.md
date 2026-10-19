# Account / Session Runtime Audit

Run: `autonomous-build-account-audit-20261017`
Repository: `/Users/nam/Documents/marketing-seeding-integration`
Branch: `integration/autonomous-build`
Scope: read-only source, test, and canonical-state inspection. No browser, credential, session, network, or social action was performed.

## Unverified items first

- **UNVERIFIED:** no live browser/session check was run; ORCA executable 1.4.229 is available locally, so the canonical account's current LinkedIn session cannot be independently confirmed here.
- **UNVERIFIED:** no credential broker, OAuth refresh, login, MFA, CAPTCHA, device approval, browser-profile provisioning, or account failover was exercised.
- **UNVERIFIED:** dashboard does not expose a dedicated execution-account inventory/health projection; account data is visible through state/service internals and execution evidence, not a first-class Mission Control account view.
- **UNVERIFIED:** canonical service state is read-only inspected only; its running process may advance independently after this snapshot.

## Evidence ledger

### FACT

1. `src/readiness.mjs:45-71` normalizes an execution account to `{platform, accountId, profileId, identityReference/expectedIdentityUrl, status, health, lastReadinessAt}`. LinkedIn requires an immutable ORCA UUID profile ID (`:49-50`). Status is `enabled|disabled`; health is `unknown|healthy|blocked|human_required|error` (`:52-55`). No credential or cookie field is accepted or persisted.
2. `src/service.mjs:2689-2703` provides `registerExecutionAccount`; it persists through `JsonStore`, updates an existing account by stable `platform:accountId` ID, and rejects two enabled accounts sharing one platform/profile (`:2691-2693`).
3. `src/server.mjs:564-566` exposes account registration as `POST /api/execution-accounts`. There is no account listing, health mutation, session refresh, credential, login, logout, account-switch, or recovery endpoint in the inspected server routes.
4. `src/readiness.mjs:86-118` rejects secret-like readiness fields recursively and emits bounded readiness evidence with a binding hash, timestamps, capabilities, recovery classification, and exact platform/account/profile/target identity.
5. `src/readiness.mjs:121-132` requires `READY`, fresh timestamps, exact binding, and matching platform/account/profile/target before readiness can be reused. Default freshness is five minutes (`:4`, `:24-34`).
6. `src/linkedin-readiness.mjs:162-256` uses an ORCA browser adapter. It checks the expected profile, selects at most one LinkedIn tab, verifies profile identity, navigates to the feed when needed, detects login/security challenges, validates the authenticated feed and expected identity, opens and structurally confirms an empty composer, closes it, and returns a bounded `READY` result. No content entry or submission occurs in readiness (`test/readiness-execution.test.mjs:817-852`).
7. `src/readiness.mjs:135-142` classifies MFA/passkey/security/account mismatch/identity ambiguity as `HUMAN_REQUIRED`; runtime/network/page/provider failures are bounded retryable `UNKNOWN`; other provider failures remain `UNKNOWN`.
8. `src/service.mjs:1810-1979` persists readiness outcomes, updates the target readiness and account health (`READY→healthy`, `HUMAN_REQUIRED→human_required`, `BLOCKED→blocked`, other→error), records retry timing and bounded attempts, and avoids automatic retries for human-required states except a narrowly guarded canonical LinkedIn profile recheck.
9. `src/service.mjs:856-886`, `:1999-2012`, `:2300-2302`, and `:2374-2377` recheck exact account/profile binding, enabled+healthy account, and fresh readiness at request creation, worker start, pre-submit and provider-send boundaries. A mismatch fails closed.
10. `src/service.mjs:2692-2701` and `test/service.test.mjs:222-242` prove profile UUID validation, target/account profile equality, and duplicate profile binding rejection.
11. `test/readiness-execution.test.mjs` covers stale readiness refresh/reuse, retry bounds, human-required isolation, profile-missing recheck, account/profile collision, exact binding, readiness timeout/error behavior, LinkedIn session/composer detection, ambiguous tabs, security challenges, asynchronous composer mount, and no-submit readiness cleanup. `test/jev-execution-worker.test.mjs:306-319` covers unhealthy-account dispatch rejection.
12. Read-only canonical state inspection at `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json` found schema 8, revision 194, one registered account (`linkedin:linkedin_primary`), enabled/healthy, with a redacted-safe ORCA profile identity and `lastReadinessAt` timestamp. SHA-256 was computed for integrity only; no state was written.

### INFERENCE

- The current runtime is **single-bound-profile session reuse**, not an account pool or autonomous authentication runtime. Account records are policy bindings to host-managed browser profiles; they do not own credentials or session material.
- Readiness is a strong execution gate and account-health feedback loop, but it is target-scoped and transient. It proves the provider can inspect an already provisioned profile/session; it does not provision, refresh, recover, or rotate sessions.
- Existing campaign authorization, standing delegation, leases, grants, idempotency, and UNKNOWN quarantine can safely consume this account contract without a new account state machine.
- A bounded account/session milestone is justified only after live M1 proof or when a concrete operational need appears; the smallest useful next seam is an account registry projection plus explicit session-health/recovery metadata, not credential automation.

### ASSUMPTION

- The canonical state path and revision observed are the intended runtime snapshot referenced by the project journal.
- ORCA profile UUIDs and identity URLs are operator-provisioned outside this repository.

### UNKNOWN

- Whether the host's ORCA profile is persistent across browser/process restart.
- Whether any external secure credential/token broker exists outside this repository.
- Whether multiple authorized accounts are configured elsewhere but not in this canonical state file.

## Capability matrix

| Capability | Status | Evidence / limitation |
|---|---|---|
| Register account/profile binding | IMPLEMENTED + locally tested | `registerExecutionAccount`; stable ID, collision guard, LinkedIn UUID requirement. |
| Exact account/profile/target binding | IMPLEMENTED + locally tested | target creation/update and execution fences; readiness binding hash. |
| Existing-session reuse | IMPLEMENTED (provider contract) | ORCA profile/tab selection and LinkedIn feed/session/composer checks. |
| Session health classification | IMPLEMENTED (bounded) | `healthy`, `blocked`, `human_required`, `error`; readiness result propagation. |
| Freshness/expiry | IMPLEMENTED | five-minute default TTL, configurable bounded to one hour. |
| Login / credential acquisition | NOT_IMPLEMENTED by policy | No credential fields, login endpoint, OAuth/token flow, or browser login automation. |
| MFA/CAPTCHA/device approval | HUMAN_REQUIRED only | Detected and quarantined/fail-closed; no bypass or recovery automation. |
| Session refresh/recovery | PARTIAL | Recheck existing profile/session; one bounded composer-load retry; no token refresh/profile repair. |
| Account pool selection/failover | NOT_IMPLEMENTED | No selector, health-ranked failover, cooldown/risk scheduler, or account registry UI. |
| Multi-account isolation | PARTIAL | Unique profile binding and exact fences prevent collision; no demonstrated multi-account live run. |
| Logout/account switching | NOT_IMPLEMENTED | No route or adapter flow. |
| Dashboard account health view | PARTIAL | Readiness and execution evidence are projected indirectly; no dedicated account inventory endpoint/view found. |
| Secret handling | IMPLEMENTED boundary | Secret-like readiness fields rejected; no secrets stored by account model. |

## Reusable seams

- `normalizeExecutionAccount`, `executionAccountKey`, `executionAccountIdentityReference`, `readinessBinding`, `normalizeReadinessResult`, and `isReadinessFresh` in `src/readiness.mjs` are provider-neutral enough to retain.
- `LinkedInReadinessProvider` is the existing platform-specific session probe. It should remain the only place that understands LinkedIn DOM/session/composer readiness.
- `SeedingService.registerExecutionAccount` plus existing exact binding checks are the current account registry seam; do not add a second store or router.
- Existing `JsonStore` audit/revision persistence, readiness retry bounds, campaign authorization, execution leases/grants, and UNKNOWN quarantine provide the required safety substrate.

## Smallest safe future implementation (not implemented here)

1. Add a read-only account inventory projection to the existing dashboard/API: platform, account ID, profile ID fingerprint/reference, status, health, last readiness, current blocker, and last transition timestamp. Never expose credentials, cookies, profile storage, or tokens.
2. Add explicit operator-controlled account health transition/recovery metadata (for example `SESSION_EXPIRED`, `MFA_REQUIRED`, `CAPTCHA_REQUIRED`, `QUARANTINED`) using the existing health/readiness persistence, without automating security-control bypass.
3. Add deterministic account eligibility selection only after at least two independently authorized account records exist; selection must remain subordinate to campaign authorization destinations and exact profile binding.
4. Add restart/read-only tests for projection and health transitions. Do not add login automation or a duplicate account state machine.

## Recommendation

**STATUS: AUDIT_COMPLETE — NO SOURCE CHANGE RECOMMENDED IN THIS SCOUT.** Existing account/session seams are sufficient for the currently blocked single-account M1 lane. The next account-runtime milestone should be deferred until a fresh authorized live proof exists or a concrete multi-account requirement is supplied; then implement the smallest projection/health/selection seam above while preserving host-managed session reuse and fail-closed security challenge handling.

**AFFECTED ACCEPTANCE:** A1, A7, A8, A9, A10 reviewed read-only.
**EXTERNAL SIDE EFFECTS:** none.
**STATUS:** `PARTIAL / LOCAL-VERIFIED; LIVE-UNVERIFIED; AUTHENTICATION-NOT-SUPPORTED`
