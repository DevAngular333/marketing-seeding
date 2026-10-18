# Autonomous Product Distribution & Growth OS — Master Plan

## Objective

Build a bounded, evidence-driven distribution runtime in `marketing-seeding` that can inspect a product, ground claims, plan distribution, use authorized account/session execution, independently verify external outcomes, persist campaign state, and recover without per-post human operation. `SYSTEM_AGENTIC_AI` Production Core remains frozen.

## Current wave — locally implemented and verified

1. Preserve preexisting LinkedIn/ORCA and transport work.
2. Add standing campaign authorization with bounded execution delegation on existing authorization/window/grant/lease/idempotency/UNKNOWN contracts.
3. Add a monotonic kill switch and epoch fencing, plus readiness/account/identity checks at queue, worker, durable intent and final provider-send boundary.
4. Add deterministic product intelligence with evidence/claim graph, bounded local field auto-derivation and unsupported-claim quarantine.
5. Add a deterministic repository classifier and bounded local command/artifact evidence pipeline.
6. Independently review integration; run focused and complete Node tests.
7. Add a deterministic advisory strategy, evidence-grounded draft candidate, outcome summary, advisory learning feedback, opt-in control-cycle and opt-in public discovery polling foundations without creating execution authority.
8. Add bounded caller-supplied audience/channel/locale fit metadata to discovery observations without changing authority or publication semantics.
9. Add deterministic bounded artifact candidate discovery to the existing Product Factory without auto-approving publication assets.
10. Harden Product Factory project evidence to a fail-closed relative `node --check` manifest probe in temporary staging; arbitrary project scripts remain unexecuted until a real sandbox exists.
11. Verify and journal the existing provider-neutral DRY_RUN distribution handoff without promoting it to LIVE authority.
12. Add a read-only account runtime dashboard projection with profile fingerprinting, readiness/blocker visibility and secret-safe redaction; do not add login, credential, selector or failover semantics.
13. Add a compact read-only Mission Control projection over existing control-cycle, strategy, learning and outcome fields; do not add an approval or execution path.
14. Add explicit read-only account session/auth mode, eligibility and ineligibility reasons to Mission Control without adding login, selection, failover or authority semantics.
15. Add a fail-closed learning-aware advisory strategy context: current outcome/learning identifiers and allowlisted reasons are visible to strategy/Mission Control without changing action precedence or creating authority.
16. Add a bounded explicit-link-only per-post outcome attribution projection to the existing outcome summary; keep UNKNOWN dominance, canonical publication evidence requirements, campaign-only conversions unassigned and all learning/strategy behavior advisory.
17. Consume that attribution as bounded campaign-aware explanation context in existing learning/strategy decisions; retain high-risk rows under the context cap and fail closed on foreign or drifted post/target identity.
18. Harden metric observability with a closed coverage vocabulary and deterministic latest-snapshot projection shared by traffic pulse and dashboard.
19. Materialize exact evidence-grounded content candidates with source revalidation and bind exact approved-copy candidates to existing standing campaign authority; preserve draft-only behavior for inactive campaign and inactive/ambiguous authority.
20. Add a queue-only authorized content candidate scheduler that removes per-post approval for exact active approved-copy scope while reusing existing readiness/request/window/grant/idempotency controls; local scheduler proof passes, live publication remains blocked.
21. Add bounded read-only campaign queue runtime observability to `/health` and Mission Control without adding authority or execution controls; local lifecycle/server and full-suite gates pass.
22. Isolate per-campaign queue failures so healthy campaigns continue and expose bounded failure codes through existing read-only observability; local focused proof passes, live execution remains blocked.
23. Add the versioned deterministic `approved_template_set` candidate binding contract; exact template candidates reuse the same standing queue controls while legacy/manual/ambiguous candidates remain draft-only.
24. Add deterministic evidence-grounded product-intelligence story derivation over the existing READY handoff; keep it draft-only, idempotent and source-revalidated, with no queue or authority side effects.
25. Add queue-owned story derivation only behind an explicit bounded campaign CTA/content policy; require current authorization and campaign fingerprints before deriving, and preserve draft-only/idempotent behavior.
26. Reverify and journal deterministic product-understanding auto-derivation on the integrated branch; preserve explicit-claim precedence and local-only evidence boundaries.
27. Restore optional-fit compatibility at the discovery-to-strategy seam while keeping explicit fit fail-closed.
28. Promote an exact successful Product Factory evidence candidate into the existing artifact schema through an operator-only, source/hash-bound, idempotent path; create no authority or execution state.

29. Add bounded post-level metric advisory context to the existing outcome/learning projection. Require explicit measured coverage for response claims, quarantine malformed measurements, validate advisory data by recomputation, and keep the bounded projection self-consistent under truncation; do not change action precedence or authority.

30. Make existing official metric collection idempotent by provider source and
post while preserving collector-run observability, immutable changed snapshots,
per-post failure isolation and explicit manual/unconfigured outcomes; do not add
a collector store, provider router, scheduler, authority or live provider lane.

31. Add bounded read-only `1h`/`24h`/`72h` metric checkpoint observability to the
existing traffic pulse and dashboard using `publishedAt`, `metricSnapshots` and
`collectorRuns`; do not add a scheduler, collector, authority or live provider
lane.

32. Harden the existing metric-provider request seam with bounded `Retry-After`
handling for retryable responses, fail-fast non-retryable responses and
fixture-only deterministic coverage; do not add a provider router or live
provider lane.

33. Persist bounded campaign-owned discovery fit through the existing scheduler
 so configured audience/channel/locale hints reach the current observer while
 legacy no-fit campaigns remain compatible and execution authority remains
 unchanged.

34. Add an opt-in autonomous JEV dry-run rehearsal for explicitly-created
    dry-run execution requests. Require matching row/request mode flags, retain
    explicit-ID and autonomous-live precedence, skip UNKNOWN reconciliation only
    in a dry-run-only cycle, and expose bounded read-only runtime projection.
    This is a local orchestration rehearsal; it does not create live authority
    or certify LinkedIn publication.

35. Add an explicit candidate-to-JEV rehearsal handoff inside the existing
    dry-run-only lane. Require exact candidate/story/template/target/content
    lineage, fresh bound readiness and healthy account/profile state; reuse the
    existing request/lease/receipt/worker contracts and expose bounded
    counters. Do not infer rehearsal authority from live authorization and do
    not create live windows, grants, publication evidence or external actions.

Result: local implementation gates pass (latest full Node suite 449 total, 447 passed, 0 failed, 2 skipped); the explicit rehearsal handoff has 2 targeted regressions and the readiness/JEV gate is 76/76. Discovery-fit scheduler focused gate is 90/90 and independently reviewed PASS_BOUNDED; post-metrics advisory is 25/25 focused, 87/87 integrated, and independently reviewed PASS_BOUNDED; official metrics collection is 58/58 focused and independently reviewed PASS (bounded); metric checkpoint observability is 59/59 focused and independently reviewed ACCEPT_BOUNDED. The scheduler story/content/service focused gate is 52/52, the broader story/product-intelligence/service/server gate is 74/74, the standing-template scheduler gate is 47/47, the template-binding focused service/server gate is 46/46, the queue failure-isolation gate is 47/47, the queue observability gate is 46/46, the authorized candidate scheduler gate is 42/42, metrics observability is 39/39, post-attribution learning/strategy is 20/20 with combined 56/56, and outcome attribution is 42/42. UI typecheck and production build also pass from the prior release gate. No social action/live publish took place. The M1 live acceptance remains blocked because canonical runtime has no active exact LIVE authorization, window, grant or lease and ORCA is unavailable in this shell.

## Later waves (dependency order)

1. **Unblock controlled live M1** only when a fresh authorized account/profile/target/content/session and harmless post policy are supplied; execute once through existing JEV/LinkedIn path, independently verify, then freeze the proven contract.
2. Versioned upstream System-Agentic → marketing domain handoff; the downstream DRY_RUN validator/persistence seam exists locally, but upstream live producer/consumer wiring remains.
3. Extend content candidates into idempotent posts and exact standing-authority binding. Approved-copy and versioned approved-template candidates may enter existing queue/readiness/window/grant controls; inactive, ambiguous or malformed authority remains draft-only.
4. Expand Product Factory into project-specific build/run/render/media workflow only after a separately audited sandbox; current manifest probe intentionally supports syntax checks only, candidate discovery is evidence-only, and operator promotion now reuses the canonical artifact schema without granting publication authority.
5. Extend the local deterministic discovery and advisory strategy foundations into continuous authorized observation, audience/channel/community eligibility, outcome-driven NBA and grounded content generation; per-post attribution and bounded learning context now exist as advisory evidence, while authority rerouting remains unimplemented.
6. Add contextual engagement, account/session registry/recovery, metrics learning, restart/24-7 hardening and deeper Mission Control projections; the current account view exposes session/auth mode and eligibility read-only but does not select, fail over or execute accounts; certify platforms incrementally.

## Frozen seams

Reuse `JsonStore`, `SeedingService`, campaign authorization, one-time windows, live grants, execution leases, exact dispatch, LinkedIn adapter/verifier, browser transport evidence, UNKNOWN quarantine, dashboard and platform registry. Do not create a duplicate store/router/state machine/browser abstraction/LinkedIn publisher or change System-Agentic Core.

## Evidence policy

Runtime, source, tests and artifacts outrank README/plans. Synthetic/local evidence never counts as real platform proof. `COMMAND_COMPLETED` does not imply activation, acceptance or publication. Post-submit uncertainty remains quarantined. No live action without exact current authority.

Latest local gate after item 25: `npm test` reports 420 total, 418 passed, 0 failed, 2 skipped; focused scheduler/story gate reports 52/52 and the broader product-intelligence/service/server gate reports 74/74; syntax and diff checks pass. No social action or canonical/UNKNOWN mutation occurred.

27. Restore optional-fit compatibility at the discovery-to-strategy seam: no-fit observations retain legacy advisory selection while explicit fit remains fail-closed; no authority or execution semantics changed.

Latest local gate after item 27: `npm test` reports 422 total, 420 passed, 0 failed, 2 skipped; discovery/service/strategy focused gate reports 77/77; independent fit compatibility review PASS (bounded); syntax and diff checks pass. Canonical runtime schema 8 revision 194 SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` remained unchanged. No social action/live publish took place.

Latest local gate after item 30: `node --test test/service.test.mjs test/server.test.mjs test/integrations.test.mjs` reports 58 passed, 0 failed, 0 skipped; `npm test` reports 430 total, 428 passed, 0 failed, 2 skipped; source syntax and diff checks pass. Independent review is PASS (bounded). Canonical runtime revision 194 and SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` remained unchanged. No live provider, browser, ORCA or social action took place.

Latest local gate after item 31: `node --test test/service.test.mjs` reports 59 passed, 0 failed, 0 skipped; `npm test` reports 435 total, 433 passed, 0 failed, 2 skipped; source syntax and diff checks pass. Independent review is ACCEPT_BOUNDED. Canonical runtime revision 194 and SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` remained unchanged. No live provider, browser, ORCA or social action took place.

Latest local gate after item 32: `node --test test/integrations.test.mjs test/service.test.mjs test/server.test.mjs` reports 70 passed, 0 failed, 0 skipped; `npm test` reports 444 total, 442 passed, 0 failed, 2 skipped; edited-file syntax and diff checks pass. Independent review is PASS_BOUNDED after negative/signed `Retry-After` hardening. Canonical runtime revision 194 and SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` remained unchanged. No live provider, browser, ORCA, credential or social action took place.

Latest local gate after item 34: `node --test test/readiness-execution.test.mjs test/jev-execution-worker.test.mjs` reports 76 passed, 0 failed, 0 skipped; `npm test` reports 447 total, 445 passed, 0 failed, 2 skipped; source syntax and `git diff --check` pass; independent review `ACCEPT`. Canonical runtime schema 8 revision 194 SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` remains unchanged. No live provider, browser, ORCA, credential, social or UNKNOWN mutation occurred.

Latest local gate after item 35: targeted rehearsal handoff regressions report 2 passed, 0 failed, 0 skipped; `node --test test/readiness-execution.test.mjs test/jev-execution-worker.test.mjs` reports 76 passed, 0 failed, 0 skipped; `npm test` reports 449 total, 447 passed, 0 failed, 2 skipped; source syntax, journal JSON parsing and `git diff --check` pass. Independent review `ACCEPT`. Canonical runtime schema 8 revision 194 SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` remains unchanged. No live provider, browser, ORCA, credential, social or UNKNOWN mutation occurred.
