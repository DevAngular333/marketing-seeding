# Task — BUILD · deterministic strategy and next-best-action foundation

## Identity

Run: strategy-foundation-20261017 · Role: BUILD · Controller: /root  
Independent verifier: /root/integration_review (read-only)  
Workspace: `/Users/nam/Documents/marketing-seeding-strategy` · Work dir: `plans/autonomous-build/strategy-foundation`  
Report path: `plans/autonomous-build/reports/strategy-foundation-worker.md`

## Acceptance IDs

A1-A7; C1-C4; V1-V2, V4.

## Read first

- `plans/autonomous-build/strategy-foundation/acceptance.md`
- `src/service.mjs`
- `src/discovery.mjs`
- `src/guards.mjs`
- `src/submission-uncertainty.mjs`
- dashboard projection in `src/service.mjs`
- `test/service.test.mjs`

## Allowed to change

- New bounded strategy module under `src/`.
- New strategy unit/runtime tests under `test/`.
- Minimal additive `SeedingService` method and dashboard projection.
- Additive local route only if needed for read-only strategy inspection; no publish route.
- `plans/autonomous-build/reports/strategy-foundation-worker.md`.

## Read-only paths

All LinkedIn/JEV/ORCA, authorization/grant/window/lease, store schema/migrations, System-Agentic files and canonical runtime state.

## Objective

Implement a deterministic advisory planner over already persisted campaign data. Prefer a ready eligible draft/post only when all existing queue/authority checks already pass; otherwise choose `engage` for an eligible relevant discovery with an existing grounded draft/reply opportunity, `research` for relevant observations needing more evidence, `wait` for an active schedule/cooldown, or `do_nothing` when no safe action exists. Every decision must include a bounded reason list, evidence references and no authority side effect. Persist at most 24 decisions per campaign and survive a new `JsonStore` instance. Reuse current state; do not invent a provider or crawler.

Do not modify the canonical state or run the server against it.

## Forbidden

No external/network/browser/ORCA/JEV calls, no credentials, no post creation, no queueing, no authorization/grant/window/lease mutation, no schema migration, no strategy state machine, no LLM/provider integration, no dashboard redesign.

## Routing

ROLE: BUILD · TIER: workhorse · EFFORT: high · ROUTING REASON: bounded deterministic domain slice with existing state contracts.

## Authority

Local isolated fixture state only. All external and canonical runtime state is read-only. No approval gate is needed for reversible local code/tests; stop on any contract change requirement.

## Verification

Run strategy-focused tests, existing service tests, `node --check src/*.mjs` and `git diff --check` after the last change.

## Worker preamble

Keep FACT/INFERENCE/ASSUMPTION/UNKNOWN ledger. Inspect project documents first. Before each consequential action state `PREDICT:`. Attack edge inputs and report unverified items first. Success test = A1-A7, C1-C4, V1-V2, V4. Constraints: local-only, no external side effects, no frozen contract changes. Reversibility: two-way.

## Completion report

Include acceptance IDs addressed, summary, evidence, confidence, out-of-scope noticed, then exactly:

`Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`  
`Summary: ...`  
`Concerns/Blockers: ...`
