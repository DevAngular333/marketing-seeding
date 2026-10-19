# Integration Safety Review — 2026-10-19

## Scope

Read-only review of `integration/autonomous-build` after integration of:

- standing autonomous delegation proof;
- ORCA accessibility/pointer transport certification artifacts;
- authorized account/session candidate projection;
- read-only engagement context projection;
- journal and blocker-ledger updates.

No source, canonical runtime state, browser profile, credentials, or external platform was modified by this review.

## Evidence inspected

- `src/service.mjs`
- `src/engagement-context.mjs`
- `src/standing-campaign-delegation.mjs`
- `src/jev-execution-worker.mjs`
- `src/linkedin-adapter.mjs`
- `src/browser-interaction-transport.mjs`
- `src/transport-certification.mjs`
- `test/standing-autonomous-delegation-proof.test.mjs`
- `test/authorized-account-candidate-projection.test.mjs`
- `test/engagement-context.test.mjs`
- existing JEV, LinkedIn verification, click-transport, grant/window, and UNKNOWN-quarantine tests
- canonical runtime state (read-only): `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`

## Safety findings

### Authorization and dispatch boundaries

- Standing authorization is explicit (`executionMode: standing_autonomous`, `allowLiveExecution: true`) and is fingerprint-bound to campaign scope.
- Queueing derives one exact request, one-time window, execution-scoped grant, and exact lease. Re-running the scheduler is idempotent in the proof fixture.
- The worker still requires the exact request/window/grant/lease and revalidates account, profile, target, content, visibility, readiness, and kill-fence controls before provider input.
- Account candidate projection is advisory only. It does not create authority, windows, grants, leases, requests, account selection, failover, login, or browser calls.

### Side-effect boundaries

- `projectAuthorizedAccountCandidates`, `projectEngagementContext`, and `SeedingService.dashboard()` are read-only projections; tests assert state equality before/after and restart-equivalent output.
- Engagement candidates do not call a provider or send replies. Existing approval and send methods remain separate; unsupported channels, missing external IDs, stale readiness, already-sent replies, and UNKNOWN posts fail closed.
- No new direct click, submit, retry, reconciliation mutation, or platform API path was introduced by these changes.
- `COMMAND_COMPLETED` remains separate from semantic activation, platform acceptance, and independent publication verification.
- Historical UNKNOWN records remain quarantined and immutable; the reviewed code does not redispatch or mutate them.

### Secret and identity handling

- Candidate and engagement projections expose bounded fingerprints/references and allowlisted fields only. Tests verify absence of profile IDs, tokens, raw readiness evidence, and secret-like fields.
- No credential/session material appeared in the diff or test output.

## Canonical runtime check

Read-only SHA-256: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
Revision: `194`.

Counts: active authorizations `0`; active windows `0`; active grants `0`; execution leases `0`; published posts `0`; historical UNKNOWN executions `4`.

The four UNKNOWN execution IDs were unchanged and were not retried or reconciled.

## Verification runs

Focused safety/transport/delegation/engagement gate:

```text
node --test test/engagement-context.test.mjs \
  test/standing-autonomous-delegation-proof.test.mjs \
  test/authorized-account-candidate-projection.test.mjs \
  test/browser-interaction-transport.test.mjs \
  test/click-transport.test.mjs \
  test/linkedin-verification.test.mjs \
  test/jev-execution-worker.test.mjs
```

Result: **106 passed, 0 failed, 0 skipped**.

Full suite:

```text
npm test
```

Result: **476 total, 474 passed, 0 failed, 2 skipped**.

Static checks:

- `node --check src/service.mjs` — pass
- `node --check src/engagement-context.mjs` — pass
- `git diff --check` — pass

## Findings / limitations

1. Real LinkedIn autonomous final submit, platform acceptance, independent permalink discovery, and canonical `PUBLISHED` remain unproven because no fresh exact live authorization/session exists. This remains an external live-proof blocker, not an integration safety defect.
2. ORCA 1.4.229 certification is limited to resettable local semantic-activation fixtures (10/10 accessibility and 10/10 pointer). It does not certify irreversible LinkedIn submission.
3. The engagement projection labels grounded draft/approved replies as advisory candidates and includes `REPLY_PENDING_APPROVAL` when policy requires approval. This projection has no send path; approval-gated execution remains unchanged.
4. Existing journal entries may contain historical counts or earlier probe narrative; this review treats source/tests/current runtime as authoritative.

## Re-review update — 2026-10-19

The readiness guard was corrected to reject both missing and invalid `expiresAt`, and a regression test now covers that fail-closed case. Additional visible changes (factory evidence projection, eligible target references, and discovery opportunity projection) were reviewed as bounded read-only projections; they expose allowlisted/fingerprinted data, do not create authority, and do not call providers.

Focused re-review gate:

```text
node --test test/engagement-context.test.mjs test/opportunity-projection.test.mjs \
  test/product-factory.test.mjs test/account-runtime-projection.test.mjs \
  test/authorized-account-candidate-projection.test.mjs \
  test/standing-autonomous-delegation-proof.test.mjs \
  test/browser-interaction-transport.test.mjs test/click-transport.test.mjs \
  test/linkedin-verification.test.mjs test/jev-execution-worker.test.mjs
```

Result: **133 passed, 0 failed, 0 skipped**.

Static checks: `node --check` for changed modules and `git diff --check` — pass.

## Verdict

**ACCEPT (bounded integration safety).**

The integrated changes preserve exactly-once dispatch, durable submit intent, UNKNOWN quarantine, and fail-closed account/readiness/target/content bindings. Readiness now fails closed for missing/invalid expiry. New projections remain read-only and bounded. No unsafe external side effect or historical UNKNOWN mutation was observed. The live LinkedIn proof remains explicitly blocked pending fresh authorized inputs.

## Independent diff review — 2026-10-19 (latest working tree)

### Code and contract review

- `projectFactoryRunEvidence()` is an allowlisted, bounded projection. It omits raw output and preserves only sanitized artifact path/hash/size/command references. It does not alter sandbox eligibility or execute commands.
- Account runtime changes use an injected observation time, reject invalid readiness expiry, and expose only counts/fingerprints for eligible targets. They do not select accounts or create execution artifacts.
- `projectDiscoveryOpportunities()` is advisory, bounded to 24, deduplicated by campaign plus discovery identity, and fail-closed for malformed/ineligible/unknown-fit rows. It does not derive authority or invoke a provider. Dashboard wiring preserves the original discovery collection and adds a separate projection.
- Engagement readiness now rejects missing and invalid expiry. Existing UNKNOWN, approval, and send boundaries are unchanged.
- New tests cover cross-campaign discovery identity, invalid readiness expiry, factory secret-safe projection, account target eligibility, dashboard no-write behavior, and existing standing authorization/dispatch invariants.

Targeted integration gate:

```text
node --test test/account-runtime-projection.test.mjs test/engagement-context.test.mjs \\
  test/opportunity-projection.test.mjs test/product-factory.test.mjs \\
  test/service.test.mjs test/authorized-account-candidate-projection.test.mjs \\
  test/standing-autonomous-delegation-proof.test.mjs
```

Result: **111 passed, 0 failed, 0 skipped**. Syntax and `git diff --check` passed.

### Documentation/evidence drift requiring correction

1. Several journal rows still state the previous full suite as `472 total, 470 passed, 0 failed, 2 skipped`; the latest full run in this working tree is `476 total, 474 passed, 0 failed, 2 skipped`.
2. The `Full production readiness` row still lists ORCA availability/certification as absent even though ORCA 1.4.229 is locally available and resettable fixture control activation is certified. The row should distinguish local control certification from unproven irreversible LinkedIn certification.
3. Historical milestone rows intentionally retain older counts, but current snapshot/report rows must be updated or clearly labeled historical to avoid presenting stale counts as current evidence.

## Current verdict

**REWORK (journal accuracy only; code safety ACCEPT).**

No code safety defect was found in the latest diff. Before integration sign-off, refresh current journal counts and ORCA wording, then rerun `npm test` and record its exact result. Live LinkedIn proof remains blocked by absent fresh exact authorization/session; no external side effect was attempted.

## Fresh journal/evidence consistency review — 2026-10-19

### Exact latest test evidence

Fresh command:

```text
npm test
```

Result: **483 total, 481 passed, 0 failed, 2 skipped**, exit 0.

The transport regression artifact is current and agrees with this result:
`plans/browser-interaction-transport-certification/regression-results.md` records 483/481/0/2.

### Stale current-snapshot fields

The following current snapshot or integration records still report 472/470/0/2 and should be updated to 483/481/0/2 (historical milestone rows may retain their original counts if clearly historical):

- `plans/autonomous-build/final-report.md` latest full-suite line and candidate-projection overlay;
- `plans/autonomous-build/product-readiness.md` current area rows and full-suite row;
- `plans/autonomous-build/blocker-ledger.json` ORCA and Product Factory verification strings;
- `plans/autonomous-build/integration-ledger.json` `browser_transport_full_node_suite_latest`, `full_node_suite_latest`, and related current entries.

`plans/autonomous-build/current-state.md` already records 483/481/0/2 in its latest transport and candidate overlays, but earlier historical entries remain by design.

### ORCA wording consistency

Current transport reports correctly distinguish local reversible fixture certification from unproven irreversible LinkedIn submission. The blocker/product-readiness rows still contain wording that can be read as “ORCA availability/certification absent.” Recommended wording: ORCA 1.4.229 is available and locally certified for reversible control activation; irreversible LinkedIn activation, platform acceptance, and independent publication remain unproven pending fresh exact authorization/session.

### Runtime/evidence safety

Canonical runtime remained read-only during this review. No live authorization/window/grant/lease was created; no browser or social action was attempted; historical UNKNOWN records remain immutable. Existing `live-evidence.json` reports zero social mutations and zero final Post clicks.

## Review verdict

**REWORK (journal synchronization only; implementation evidence remains ACCEPT).**

No source safety defect was found. Synchronize the listed current journal fields to the exact 483/481/0/2 result, preserve older rows as historical, then rerun or reference the same full-suite artifact. Live LinkedIn proof remains externally blocked.

## Fresh source/test diff review — 2026-10-19

### Scope and side effects

Reviewed uncommitted changes in `src/engagement-context.mjs`, `src/opportunity-projection.mjs`, `src/product-factory.mjs`, `src/service.mjs`, and associated tests. The changes are projections/read models only:

- Engagement context reads interactions/replies and preserves approval, readiness, and UNKNOWN gates; it does not call providers or mutate reply/post state.
- Discovery opportunities are bounded (24), deduplicated by campaign/discovery identity, fail closed for malformed/unknown-fit rows, and marked advisory with both authority and external side effects false.
- Product Factory evidence is capped (50 runs, 32 artifacts/run), omits raw output, and sanitizes artifact paths/command references; it does not change sandbox eligibility or execute commands.
- Account target eligibility uses exact platform/account/profile binding and finite future readiness expiry, returning only counts and fingerprints; it does not select accounts, create authority, lease, grant, window, browser input, or retry.
- Dashboard wiring adds projections while retaining the existing raw discovery view and does not write state.

No click, publish, browser, provider, network, credential/session, or canonical-runtime path was introduced. UNKNOWN quarantine and durable submit fences are unchanged.

### Contract and test evidence

Focused changed-area command:

```text
node --test test/engagement-context.test.mjs test/opportunity-projection.test.mjs \\
  test/product-factory.test.mjs test/account-runtime-projection.test.mjs test/service.test.mjs
```

Result: **107 passed, 0 failed, 0 skipped**.

Tests cover invalid/missing readiness expiry, unsupported and quarantined interactions, cross-campaign discovery identity, bounded/clamped opportunity output, factory projection redaction, account target eligibility, dashboard no-write behavior, and existing execution invariants.

### Verdict

**ACCEPT (bounded).**

No authority, browser, UNKNOWN, or secret-leakage defect was found in the source/test diff. The only remaining limitation is that projections are advisory/local and cannot establish live LinkedIn publication proof.

## Latest independent review — 2026-10-19

### Scope

Reviewed current uncommitted source/tests and journal artifacts, including the new authorized account pool projection, opportunity fit projection, Product Factory evidence projection, engagement readiness guard, updated audit artifacts, and latest transport/blocker records.

### Verification

- `git diff --check` — pass.
- JSON parse of all `plans/**/*.json` — pass.
- Focused command:

```text
node --test test/account-runtime-projection.test.mjs \\
  test/authorized-account-candidate-projection.test.mjs \\
  test/discovery-scheduler.test.mjs test/engagement-context.test.mjs \\
  test/opportunity-projection.test.mjs test/product-factory.test.mjs \\
  test/service.test.mjs
```

Result: **121 total, 120 passed, 1 failed, 0 skipped**.

### P1 finding — account pool ambiguity regression

`test/authorized-account-candidate-projection.test.mjs` test `account pool projection selects only a unique eligible candidate and fails closed on ambiguity` fails at line 166: expected `AMBIGUOUS_POOL`, received `UNIQUE_ELIGIBLE`.

Relevant paths:

- `src/service.mjs` — `projectAuthorizedAccountPool()`
- `test/authorized-account-candidate-projection.test.mjs:155-170`

The new ambiguity case must produce multiple distinct eligible candidates for the same campaign/target and leave `selectedCandidateKey` null. Current implementation/test fixture combination collapses or rejects the second authorization, so the fail-closed ambiguity contract is not proven. This requires rework before release sign-off; do not bypass the assertion or weaken the ambiguity behavior.

### Other findings

- No authority, browser, provider, credential, social, canonical runtime, or historical UNKNOWN mutation was observed.
- Product Factory remains fail-closed (`executionEligible: false`) and sandbox inventory correctly documents missing confinement/resource proofs.
- ORCA wording consistently distinguishes local reversible fixture certification from unproven irreversible LinkedIn publication.
- Current journal snapshots mostly use latest `486/484/0/2`; historical milestone rows retain older counts as expected.
- Canonical runtime remains revision 194, SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`, with four UNKNOWN executions and zero published posts.

## Verdict

**REWORK (P1 test/contract proof).**

Fix the account-pool ambiguity case and rerun the focused gate plus full suite. No external action is permitted or required for this fix.

## Re-audit after account-pool correction — 2026-10-19

The account-pool ambiguity worker correction is now verified.

Focused/current changed-area gate (including account-pool ambiguity, discovery checkpoint, engagement, opportunity, Product Factory and service regressions): **119 passed, 0 failed, 0 skipped** in the latest targeted run.

Fresh full suite:

```text
npm test
488 total, 486 passed, 0 failed, 2 skipped
```

Static checks: changed-module `node --check` and `git diff --check` pass.

Canonical runtime remains unchanged: revision `194`, SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`, four historical UNKNOWN executions, zero published posts.

Journal review: current snapshot and transport/blocker entries now consistently report 486/484/0/2 in most locations, but the latest full run is 488/486/0/2. Update current (non-historical) snapshot references and affected evidence artifacts before release commit. Older milestone counts remain valid as historical evidence. ORCA wording remains correct: local reversible fixture activation only; irreversible LinkedIn activation/publication unproven.

### Verdict

**REWORK (journal count synchronization only).**

Implementation and safety contracts are ACCEPTED; update current journal/test-result counts to 488/486/0/2, preserve historical rows, and then commit. No external side effect or UNKNOWN mutation occurred.
