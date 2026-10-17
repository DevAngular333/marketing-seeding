# Task — implementation · canonical System-Agentic handoff compatibility
## Identity
Run: system-agentic-handoff-20261017 · Role: BUILD · Controller: /root
Independent verifier: /root (fresh read-only review after change)
Workspace: /Users/nam/Documents/marketing-seeding-integration · branch integration/autonomous-build
Work dir: plans/autonomous-build/system-agentic-handoff · Report path: plans/autonomous-build/reports/system-agentic-handoff-worker.md

## Acceptance IDs
A1–A5, C1–C5, V1–V4 from `acceptance.md`.

## Read first
1. `plans/autonomous-build/system-agentic-handoff/acceptance.md`
2. `src/distribution-handoff.mjs`, `src/service.mjs`, `test/distribution-handoff.test.mjs`
3. `/Users/nam/Documents/System-Agentic_AI/agent-brain/modules/product_contracts.py`
4. `/Users/nam/Documents/System-Agentic_AI/agent-brain/modules/distribution_handoff.py`
5. `plans/autonomous-build/current-state.md` and `plans/autonomous-build/dependency-graph.md`

## Allowed to change
- `src/distribution-handoff.mjs`
- `src/service.mjs` only where the existing distribution-handoff endpoint invokes validation/persistence
- `test/distribution-handoff.test.mjs`
- `plans/autonomous-build/system-agentic-handoff/`
- `plans/autonomous-build/reports/system-agentic-handoff-worker.md`

Everything else is read-only. Do not modify SYSTEM_AGENTIC_AI, canonical runtime state, browser code, LinkedIn adapter, authorization/grant/lease code, dashboard, or any historical execution/UNKNOWN record.

## Objective
Inspect the existing downstream DRY_RUN handoff seam and add the smallest compatibility path for canonical provider-neutral ProductRun/ProductArtifact/MediaArtifact/ContentVariant/ContentPackage/DistributionIntent envelopes. Reuse the current validator and persistence path where possible. The result must remain DRY_RUN-only and metadata/evidence-only; it must not create content candidates unless the existing exact campaign-bound path can prove identity. Add focused regression tests for acceptance, rejection and no-side-effect behavior.

## Non-goals
No upstream code changes, no LIVE handoff, no provider dispatch, no browser action, no campaign authorization derivation, no credential/session automation, no new store/router/state machine/abstraction, no migration of canonical state.

## Routing
ROLE: implementation · TIER: workhorse · EFFORT: high · ROUTING REASON: bounded compatibility seam over existing contracts; source and tests identify the existing ownership.

## Authority / isolation
Local synthetic temp stores only. No external network or authenticated browser. Approval gate: stop before any publish, merge, deploy, migration, or external message. No worker sub-delegation.

## Worker preamble
Operating discipline for this task:
- Keep an evidence ledger: FACT / INFERENCE / ASSUMPTION / UNKNOWN. Verify load-bearing assumptions before building on them.
- The task's stated bug location or prescribed solution is a hypothesis; diagnose independently and fix at root. Do not widen scope.
- Before executing, sweep project documents for constraints. Delete/overwrite/publish/send are one-way doors; do not perform them.
- Before each consequential action state PREDICT and stop on surprise. Use the cheapest disproof experiment first.
- After forming a hypothesis, test it. Two failed fix attempts means report BLOCKED.
- Before reporting done, attack edge inputs and rerun the original success test after the last change.
- Report what could not be verified first; label facts/inferences/assumptions and name the weakest link.

Success test for this task: A1, A2, A3, A4, A5, V1, V2, V3, V4.
Constraints: C1, C2, C3, C4, C5.
Reversibility: two-way.

## Completion report
End with exactly the required acceptance table, evidence, confidence, out-of-scope, and `Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT` line.
