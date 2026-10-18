# Current State (verified 2026-10-18)

## Repository

- Integration worktree: `/Users/nam/Documents/marketing-seeding-integration`
- Branch: `integration/autonomous-build`
- Integration branch `integration/autonomous-build` includes the outcome-learning strategy and post-attribution learning context on top of `0c8bbe3` (`feat: add bounded post outcome attribution`); it includes the Product Factory project-evidence safety seam, strategy fit gate, learning-aware advisory context and bounded campaign-aware attribution validation. The branch also includes the Mission Control account/session section, product-understanding derivation, account-runtime readiness projection and canonical DRY_RUN handoff artifacts.
- Main worktree `/Users/nam/Documents/marketing-seeding` was not modified.
- Integration branch contains the accepted local source changes, content-candidate authorization-binding seam and release artifacts; no source change has been merged into `main`.
- `SYSTEM_AGENTIC_AI` Core was not modified.

## Runtime

- Canonical state: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`
- Schema: 8; revision: 194; SHA-256: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` (read-only inspection; the running canonical service advanced this revision independently).
- Read-only `/health`: service PID 64620, listener `127.0.0.1:4318`, source commit `b4fa42b…`, schema 8, revision 194. Canonical service has traffic, control-cycle, discovery, browser-tracking and fixture timers disabled.
- Traffic collector, daily automation, browser tracking and fixture worker disabled.
- No active execution leases, active live grants, active one-time windows, or active campaign authorizations.

## Local capability additions

- Product intelligence handoff is versioned, hash-validated, sanitized, persisted on campaigns and projected read-only by `/api/dashboard`; a separate provider-neutral distribution handoff is implemented as an idempotent `DRY_RUN`-only metadata seam and is not live upstream wiring.
- Product intelligence can derive bounded descriptive fields from normalized
  local repository evidence and safe package metadata when explicit claims are
  absent. Explicit evidence-grounded claims remain authoritative; unsupported
  fields remain null and are listed in `CLAIMS_WE_CANNOT_MAKE`. This is
  deterministic local heuristic inference, not LLM research or market proof.
- Repository inspection can now read a bounded allowlist of safe repository files, redact credential-like material, produce stable evidence hashes and persist metadata-only inspection lineage with the handoff.
- Discovery observations are normalized, deduplicated, policy-classified, scored, persisted on campaigns and projected read-only by `/api/dashboard`; integration adds an opt-in public HTTP observer and 15-minute poller, which are not enabled in the canonical service.
- Discovery fit metadata now evaluates caller-supplied audience terms, channel and locale hints as bounded `MATCHED`/`MISMATCHED`/`UNKNOWN` advisory evidence through the existing persistence path; it does not create authority or publication work.
- Product factory runtime can classify/run the registered campaign repository with the bounded allowlist, discover bounded media/document candidates when paths are omitted, return local artifact hashes, persist a bounded 24-run campaign-owned lineage and project recent runs read-only; it reports `externalSideEffects: false` and does not create publication authority.
- Product Factory project evidence is fail-closed: only relative `node --check` JavaScript manifest commands are eligible, and eligible probes run in temporary staging with bounded cleanup and artifact evidence. Arbitrary scripts, package managers, interpreters and build/render commands remain `NOT_EXECUTED_UNSAFE` until a separately audited sandbox exists.
- Account runtime now has a deterministic read-only `accountRuntime`/`executionAccounts` dashboard projection with profile fingerprints, bounded readiness/blocker fields and bound-target counts; raw profile IDs, identity URLs, evidence and secret-like fields are excluded. This is an observability seam, not login, credential, selection or failover automation.
- Account runtime projection now also exposes explicit `SESSION_REUSE` / `MANUAL_AUTH` mode labels, fail-closed `eligibleForExecution`, and deterministic `ineligibilityReasons`; these fields are read-only observability and are not consumed as authority or a selector.
- Mission Control now renders those bounded account/session fields from the existing GET-only dashboard projection; it adds no approval, login, selection, failover, browser or execution control.
- Advisory strategy now accepts only current, structurally valid learning feedback linked to the current outcome summary and records bounded learning/outcome evidence plus normalized post-attribution context; campaign-aware post/target/channel identity is checked before exposure and account/profile values are fingerprinted in the advisory projection. Action precedence and UNKNOWN quarantine remain unchanged. It does not perform outcome rerouting or execution.
- Outcome summaries now also expose bounded explicit-link-only `postAttributions` with `UNKNOWN` > `VERIFIED` > `PARTIAL` > `UNOBSERVED` precedence, canonical publication evidence checks, deterministic latest metrics and unassigned campaign-only conversions. This is advisory evidence only and does not reroute strategy or create authority.
- Metric observability now accepts only the `measured`/`unknown`/`unsupported` coverage vocabulary, and dashboard/traffic-pulse latest snapshot selection uses the same deterministic capture-time plus snapshot-ID ordering as outcome summaries. Invalid persisted coverage is normalized into a bounded dashboard bucket; no metric collection or authority semantics changed.
- Content candidates can now be materialized idempotently with exact story/source/content lineage. The campaign queue automatically handles candidates only under one exact active `standing_autonomous` authorization with approved-copy or versioned approved-template scope, and only while the campaign itself is active; inactive, missing, ambiguous, paused, revoked, expired or malformed template candidates remain draft-only. Existing readiness/request/one-time-window/live-grant controls are reused.
- The campaign queue now exposes a bounded read-only runtime projection at `/health.campaignQueue` and `/api/dashboard.automation.campaignQueue`: enabled state, fixed interval, running state, start/completion timestamps, next run and bounded cycle counts/error reason. It reuses the existing scheduler and queue service seam and adds no authority or external side effect.
- Queue evaluation now isolates candidate-materialization and per-campaign queue failures, continues healthy campaigns, preserves the successful `{ campaignId, decisions }` result shape, and reports bounded failure codes through the existing queue projection. Shared expiry/store failures remain fail-closed at the cycle boundary.

## Counts

7 campaigns (active); 10 authorizations (5 expired, 2 superseded, 3 paused); 7 one-time windows (all `CONSUMED`); 7 grants (4 `CONSUMED`, 3 `REVOKED`); 8 execution requests (1 dry-run complete, 4 `SUBMIT_RESULT_UNKNOWN`, 3 failed); 8 receipts; 7 posts (4 `submit_result_unknown`, 3 blocked); 4 publication attempts (all `unknown`); 4 submission uncertainties (`UNKNOWN`); 4 verified artifacts; 0 stories; 0 published; 0 metrics/interactions/replies/conversions.

## Protected history

Historical UNKNOWN execution IDs: `ce9cfc41-528b-425f-9dee-ab2563b50ed3`, `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`, `c2265ddf-4384-4339-a26b-4949b6a12af9`, `8e058f6e-5f67-4078-99bf-6cf86e1b62d7`; uncertainty `df39df1c-2f06-4c20-8e9a-4ed07f5df34c`. All remain immutable.

## Tests

- Focused discovery/service/server gate: 50 passed, 0 failed, 0 skipped; observer-hardening focused subset 17/17; audience-fit focused review 39/39; Product Factory project-evidence/runtime/service gate 45/45; distribution-handoff/service/server gate 33/33. Content candidate materialization/authorization focused gate: 44 passed before scheduler, then 42 service/server tests passed with inactive-campaign hardening; template candidate binding service/server gate 46/46.
- Full suite after learning-aware strategy context: 384 total, 382 passed, 0 failed, 2 skipped; exit 0. The focused strategy/control-cycle/learning/outcome/service/server gate is 49/49.
- Metrics observability hardening gate: service/outcome 39 passed, 0 failed, 0 skipped; the pre-materialization full Node suite was 397 total, 395 passed, 0 failed, 2 skipped. Latest full Node suite is 410 total, 408 passed, 0 failed, 2 skipped; latest edited-file syntax checks and `git diff --check` passed.
- Outcome attribution gate: focused outcome/control-cycle/learning/service 42 passed, 0 failed, 0 skipped; full suite 388 total, 386 passed, 0 failed, 2 skipped; independent review ACCEPT (bounded).
- Post-attribution learning context gate: focused learning/strategy 20 passed, combined strategy/control-cycle/learning/outcome/service/server 56 passed, full suite 393 total, 391 passed, 0 failed, 2 skipped; independent review rework findings resolved with late-UNKNOWN retention and campaign-aware identity checks.
- UI typecheck: `cd ui && npx tsc --noEmit` passed; production build: `cd ui && npm run build` passed with only existing Vite config warnings.
- Account runtime projection focused gate: 5 passed, 0 failed, 0 skipped; combined projection/service/server gate: 34 passed, 0 failed, 0 skipped; independent verifier: PASS (bounded).
- Mission Control account/session UI: TypeScript check and production build passed; independent read-only verifier PASS (bounded).
- Strategy fit gate: focused 36 passed, 0 failed, 0 skipped; independent review ACCEPT (bounded).
- Learning-aware strategy context: focused 49 passed, 0 failed, 0 skipped; independent review ACCEPT (bounded).
- Static checks: `node --check src/*.mjs` and `git diff --check` passed.
- Queue observability focused gate: 46 passed, 0 failed, 0 skipped; latest full Node suite: 410 total, 408 passed, 0 failed, 2 skipped; edited-file syntax and diff checks passed.
- Queue failure-isolation focused gate: 47 passed, 0 failed, 0 skipped; independent review ACCEPT; no authority/browser/canonical/UNKNOWN mutation.

## Latest content-candidate authorization seam

- Local/synthetic only. Exact approved-copy and versioned approved-template candidates enter the existing standing delegation path only from the queue when campaign and authority are active and exact. Paused, revoked, expired, ambiguous, inactive-campaign and malformed-template cases remain draft-only. Repeated queue ticks/restart preserve one post/request/window/grant. No authority is invented and no per-post approval UI was added.

## Template candidate binding milestone

- Added contract version 1 for deterministic `approved_template_set`
  candidates: template fingerprint, canonical claim IDs, source hashes and
  authorization binding are persisted and included in candidate identity.
- Materialization revalidates the exact template render, disclosure, claim and
  source bytes, target/account/profile/URL, audience, visibility and policy
  before reusing existing queue controls.
- Focused service/server tests: 46 passed, 0 failed, 0 skipped. Independent
  reviewer ACCEPT. This remains local/synthetic; no live browser/platform
  action occurred.

## Live proof

`LIVE_PROOF_BLOCKED`: no fresh exact LIVE campaign authorization, one-time window, execution-scoped grant, lease, or explicit harmless test content/session input exists. ORCA is unavailable in this shell. No browser mutation or social mutation occurred.

## Mission Control read-model milestone

- Added one compact read-only advisory panel over the existing `/api/dashboard`
  response. It shows control-cycle status, advisory strategy/learning actions,
  publication verified/UNKNOWN counts and measured metric coverage.
- No route, store, approval step, execution control, browser action or runtime
  write was added. See `plans/autonomous-build/mission-control-read-model/`.

## Campaign queue runtime observability milestone

- Added a read-only queue health projection to the existing `/health` and
  dashboard automation responses. The projection is allowlisted and bounded;
  it does not expose raw errors, state paths, credentials or controls.
- Lifecycle/server assertions cover the projection and shutdown behavior. The
  implementation remains local/synthetic evidence and does not certify ORCA,
  LinkedIn activation, acceptance or publication.

## Campaign queue failure isolation milestone

- Per-campaign candidate-materialization and queue errors are now bounded and
  isolated. A failing campaign cannot starve the next healthy campaign.
- Failure results expose only safe uppercase reason codes (or the generic
  fallback `campaign_queue_failed`); raw exception details stay local.
- Existing authority, readiness, grant/window/lease, idempotency and UNKNOWN
  behavior is unchanged. See `plans/autonomous-build/campaign-queue-failure-isolation/`.

## Standing template candidate scheduler (2026-10-18)

- The queue now derives versioned `approved_template_set` candidates from persisted stories for an active campaign with exactly one active `standing_autonomous` authorization and `allowLiveExecution === true`.
- Derivation is deterministic, bounded to authorized targets/templates/claims/source refs, rereads state before materialization, and never overwrites an existing candidate identity.
- Existing materialization, readiness, request, one-time window, live grant, lease, idempotency and UNKNOWN controls remain the only execution path.
- Paused, inactive, ambiguous, expired, revoked and malformed authority remains draft-only. No live/browser/social/canonical/UNKNOWN mutation occurred.
- Focused scheduler/template service gate: 47 passed, 0 failed, 0 skipped. Latest full suite: 412 total, 410 passed, 0 failed, 2 skipped.

## Product intelligence story draft (2026-10-18)

- Added deterministic `SeedingService.deriveProductIntelligenceStory` over the existing persisted READY product-intelligence handoff and `JsonStore` story collection. It requires four supported, evidence-grounded fields: `WHAT_IS_IT`, `WHAT_PROBLEM_DOES_IT_SOLVE`, `WHY_IS_IT_BETTER` and `WHO_NEEDS_IT`.
- The service revalidates handoff integrity, repository inspection hashes and records, current evidence bytes, source lineage, bounded CTA/disclosure and credential-like input before persisting. The derived row is deterministic, restart-safe, idempotent and always `status: "draft"`.
- The base service method remains draft-only and execution-free. Queue invocation
  is separately gated by the explicit story-policy milestone below.
- Focused story/content/service gate at the base milestone: 67 passed, 0 failed,
  0 skipped. The current full suite is recorded below as 420 total, 418 passed,
  0 failed, 2 skipped; syntax and `git diff --check` passed. Independent review:
  ACCEPT.
- Evidence is LOCAL / SYNTHETIC only. Canonical runtime and all four historical UNKNOWN executions remain unchanged. Live LinkedIn proof remains blocked by absent exact authorization/session and unavailable ORCA.

## Scheduler-owned product story derivation (2026-10-18)

- Queue scheduling now accepts an explicit bounded `contentBoundary.storyPolicy`
  only inside an `approved_template_set` authorization. CTA, disclosure and
  language are normalized, bounded, credential/session-filtered and included in
  the authorization fingerprint.
- The queue derives at most one deterministic draft story for an active
  campaign with exactly one active `standing_autonomous` authorization,
  `allowLiveExecution === true`, a valid authorization binding and a valid
  campaign-scope binding. It reuses the existing product-intelligence story
  method and `JsonStore`.
- Missing policy, incomplete READY handoff, ambiguous authority, stale or
  tampered bindings and source drift remain draft-only and create no candidate,
  post, request, window, grant or lease. Existing template materialization and
  UNKNOWN/idempotency controls remain the only execution route.
- Focused scheduler/story gate: 52 passed, 0 failed, 0 skipped. Broader
  product-intelligence/service/server gate: 74 passed, 0 failed, 0 skipped.
  Full Node suite: 420 total, 418 passed, 0 failed, 2 skipped. Independent
  review: ACCEPT. No browser, ORCA, LinkedIn, social, canonical or historical
  UNKNOWN mutation occurred.
