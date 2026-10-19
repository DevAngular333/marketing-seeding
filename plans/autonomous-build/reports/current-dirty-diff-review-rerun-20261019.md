# Current dirty diff safety review — 2026-10-19 rerun

Worktree: `/Users/nam/Documents/marketing-seeding-integration`
Scope: standing autonomous authorization, browser transport certification/immutability, durable submit evidence, and UNKNOWN quarantine. Read-only review.

## Verdict

**ACCEPT** for the reviewed local contracts. This does not upgrade the lane to LIVE_REAL_WEBSITE publication proof.

## Findings and evidence

### Standing authorization

`src/campaign-authorization.mjs` validates explicit `standing_autonomous` mode, bounded validity, exact destinations/account/profile bindings, content boundary, audience/visibility, schedule, quotas, and standing reference. `src/service.mjs` derives one-time windows and execution-scoped grants only through standing scheduler actors, revalidates campaign/authorization/content/target/account/profile/readiness bindings atomically, and binds the grant to one execution ID. Existing active grant reuse is revalidated inside the mutation; stale bindings fail closed. `test/standing-autonomous-delegation-proof.test.mjs` covers derivation, races, stale bindings and reuse.

### Transport boundary

`src/browser-interaction-transport.mjs` now requires exact provider and providerVersion equality across runtime, certification, and transport. Strict irreversible mode additionally requires LinkedIn and `IRREVERSIBLE_LINKEDIN_SUBMIT` scope. `src/server.mjs` wires accessibility and pointer candidates with strict certification enabled. `src/linkedin-adapter.mjs` selects deterministically before intent, probes ORCA runtime readiness, persists the full identity, and rejects any post-intent identity drift (transport/provider/version) before browser input. Tests cover provider mismatch, version mismatch, strict certification scope and mutation with zero click.

### Durable submit evidence

`src/service.mjs:145-164` (`hasSubmitControlEvidence`) enforces SHA-256 control identity, connected/visible/enabled/actionable/non-busy/hit-target state, OPEN and matched composer, positive geometry, single composer/editor/control ownership, payload and visibility matching, payload hashes and structural evidence version. `beginExecutionSubmitIntent` rejects invalid evidence before the state mutation; regression coverage proves request remains `REQUEST_READY`, grant remains `ACTIVE`, and no publication attempt is created.

### UNKNOWN / exactly-once

Existing `unresolvedSubmission` checks block new authority/request/grant/dispatch for uncertain jobs. Worker/adapters preserve `SUBMIT_RESULT_UNKNOWN` on post-intent ambiguity and have no blind retry or second final-click path. Historical UNKNOWN rows remain immutable in all inspected mutation paths. Reconciliation is read-only and lease-gated.

## Verification commands

```text
npm test > /tmp/mse-rerun-full.log 2>&1
```

Result: **527 tests, 525 passed, 0 failed, 2 skipped** (33.093s).

```text
git diff --check
node --check src/service.mjs
node --check src/linkedin-adapter.mjs
node --check src/browser-interaction-transport.mjs
```

All passed.

No browser input, LinkedIn/social mutation, canonical runtime state mutation, credential/session access, or external side effect occurred.

## Remaining limitation

The repository still lacks fresh authorized LIVE_REAL_WEBSITE execution proving LinkedIn semantic activation, platform acceptance, independent publication discovery and VERIFIED receipt. Current result is local contract acceptance only; live lane remains externally blocked and must stay fail-closed.
