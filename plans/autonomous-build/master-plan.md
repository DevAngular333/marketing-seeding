# Autonomous Product Distribution & Growth OS — Master Plan

## Objective

Build a bounded, evidence-driven distribution runtime in `marketing-seeding` that can inspect a product, ground claims, plan distribution, use authorized account/session execution, independently verify external outcomes, persist campaign state, and recover without per-post human operation. `SYSTEM_AGENTIC_AI` Production Core remains frozen.

## Current wave — locally implemented and verified

1. Preserve preexisting LinkedIn/ORCA and transport work.
2. Add standing campaign authorization with bounded execution delegation on existing authorization/window/grant/lease/idempotency/UNKNOWN contracts.
3. Add a monotonic kill switch and epoch fencing, plus readiness/account/identity checks at queue, worker, durable intent and final provider-send boundary.
4. Add deterministic caller-supplied product intelligence with evidence/claim graph and unsupported-claim quarantine.
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
19. Materialize exact evidence-grounded content candidates with source revalidation and bind only exact approved-copy candidates to existing standing campaign authority; preserve draft-only behavior for inactive campaign, inactive/ambiguous authority or template-set authority.
20. Add a queue-only authorized content candidate scheduler that removes per-post approval for exact active approved-copy scope while reusing existing readiness/request/window/grant/idempotency controls; local scheduler proof passes, live publication remains blocked.

Result: local implementation gates pass (latest full Node suite 406 total, 404 passed, 0 failed, 2 skipped); the authorized candidate scheduler service/server gate is 42/42, the prior content-candidate materialization/authorization gate is 44/44, metrics observability is 39/39, post-attribution learning/strategy is 20/20 with combined 56/56, and outcome attribution is 42/42. UI typecheck and production build also pass from the prior release gate. No social action/live publish took place. The M1 live acceptance remains blocked because canonical runtime has no active exact LIVE authorization, window, grant or lease and ORCA is unavailable in this shell.

## Later waves (dependency order)

1. **Unblock controlled live M1** only when a fresh authorized account/profile/target/content/session and harmless post policy are supplied; execute once through existing JEV/LinkedIn path, independently verify, then freeze the proven contract.
2. Versioned upstream System-Agentic → marketing domain handoff; the downstream DRY_RUN validator/persistence seam exists locally, but upstream live producer/consumer wiring remains.
3. Extend content candidates into idempotent posts and exact standing-authority binding. Approved-copy candidates may enter existing queue/readiness/window/grant controls; inactive or ambiguous authority remains draft-only. Template-set auto-binding remains a separately reviewed gap.
4. Expand Product Factory into project-specific build/run/render/media workflow only after a separately audited sandbox; current manifest probe intentionally supports syntax checks only and candidate discovery remains evidence-only.
5. Extend the local deterministic discovery and advisory strategy foundations into continuous authorized observation, audience/channel/community eligibility, outcome-driven NBA and grounded content generation; per-post attribution and bounded learning context now exist as advisory evidence, while authority rerouting remains unimplemented.
6. Add contextual engagement, account/session registry/recovery, metrics learning, restart/24-7 hardening and deeper Mission Control projections; the current account view exposes session/auth mode and eligibility read-only but does not select, fail over or execute accounts; certify platforms incrementally.

## Frozen seams

Reuse `JsonStore`, `SeedingService`, campaign authorization, one-time windows, live grants, execution leases, exact dispatch, LinkedIn adapter/verifier, browser transport evidence, UNKNOWN quarantine, dashboard and platform registry. Do not create a duplicate store/router/state machine/browser abstraction/LinkedIn publisher or change System-Agentic Core.

## Evidence policy

Runtime, source, tests and artifacts outrank README/plans. Synthetic/local evidence never counts as real platform proof. `COMMAND_COMPLETED` does not imply activation, acceptance or publication. Post-submit uncertainty remains quarantined. No live action without exact current authority.
