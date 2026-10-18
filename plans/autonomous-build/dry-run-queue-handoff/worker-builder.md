# Task — BUILD · explicit candidate-to-JEV dry-run queue handoff

## Identity
Run: dry-run-queue-handoff-001 · Role: BUILD · Controller: /root
Independent verifier: /root/dry-run-queue-handoff-review (different attempt)
Workspace: /Users/nam/Documents/marketing-seeding-integration · Branch: integration/autonomous-build
Work dir: plans/autonomous-build/dry-run-queue-handoff · Report path: plans/autonomous-build/dry-run-queue-handoff/worker-report.md

## Acceptance IDs
A1-A7, C1-C5, V1-V5 from acceptance.md.

## Read first
- plans/autonomous-build/dry-run-queue-handoff/acceptance.md
- plans/autonomous-build/current-state.md
- docs/JEV-LINKEDIN-EXECUTION.md
- src/service.mjs, src/jev-execution-worker.mjs, src/execution-contracts.mjs, src/guards.mjs, src/campaign-authorization.mjs
- existing readiness/JEV/service tests

## Allowed to change
- src/service.mjs
- test/readiness-execution.test.mjs and/or test/service.test.mjs
- plans/autonomous-build/dry-run-queue-handoff/worker-report.md
- plans/autonomous-build/dry-run-queue-handoff/changes.md
Everything else is read-only. Do not commit.

## Objective
Implement one bounded explicit rehearsal handoff that scans only candidates marked with explicit rehearsal metadata, validates exact campaign/story/template/candidate/target/content lineage, and creates/reuses a dry-run execution request through existing contracts. It must not infer from live standing authorization or call live window/grant methods. Reuse existing prepareExecutionRequest only if its operator guard is safely extended for this explicit scheduler actor without weakening live semantics; otherwise implement the smallest compatible path. Add tests for valid handoff, idempotence/restart, malformed or stale metadata, live candidate exclusion, no live grant/window/control mutation, and handoff to runReadyDryRunOnce with a fixture adapter. Keep post/request top-level and nested dryRun true. Do not alter the browser or LinkedIn adapter.

## Constraints / non-goals / forbidden
- No ORCA, browser, network, LinkedIn, social mutation, credentials, canonical production state, historical UNKNOWN reconciliation or retry.
- No new store, router, browser abstraction, publisher or state machine.
- Do not infer dry-run from a standing/live authorization, campaign allowLiveExecution, approval, or ordinary queued post.
- Do not create live campaign authorization, one-time window, live grant, publication evidence, or live execution lease.
- Do not alter existing live queue semantics or exact dispatch.
- Do not change SYSTEM_AGENTIC_AI.
- Do not spawn sub-workers.

## Routing
ROLE: BUILD · TIER: workhorse · EFFORT: high · ROUTING REASON: bounded implementation reuses existing contracts and is local/synthetic only.

## Authority
Write permission is limited to allowed paths above. No external side effects are authorized. Stop and report CONTRACT_CHANGE_REQUIRED if a frozen shared contract must change; do not improvise.

## Question policy
Use acceptance.md and current source as authority. Do not ask for permission for routine implementation. Surface scope changes or one-way doors only.

## Verification
Run focused tests after the last edit, syntax checks for edited source, and git diff --check. Confirm a valid fixture produces one DRY_RUN_COMPLETE and no live control artifacts. Write the worker report with the five body fields and final Status line.

## Worker preamble
Operating discipline for this task:
- Keep an evidence ledger: FACT (observed this session) / INFERENCE / ASSUMPTION / UNKNOWN. Verify load-bearing assumptions before building on them.
- The task's stated bug location or prescribed solution is the requester's hypothesis, NOT a constraint. Diagnose independently and fix at the root cause. If the root cause lies outside the stated scope, say so and either fix at source (reversible) or stop and escalate (irreversible). Never engineer around a root cause you have already identified.
- Scope is the deliverable: do not narrow, widen, or swap it. Unrelated bugs or improvements are follow-ups in your report, not changes. If one part is blocked, finish every other part and state exactly what you left out and why.
- Before executing anything, sweep the project's own documents (README, docs, style guides, runbooks, policies) for constraints on this request. A conflict between the request and a project constraint = stop and surface.
- Treat delete / overwrite / in-place migrate / publish / send as one-way doors regardless of the Reversibility field: confirm a rollback exists and run a dry-run first when available. Possible damage + no rollback = STOP, escalate.
- Before any state-changing command, confirm the evidence supports THAT action; a symptom that looks like a known failure may have another cause. Before reusing an earlier lesson, confirm its precondition holds here.
- Before each consequential action, state PREDICT: <expected outcome>. Any surprise → stop and re-model; do not patch around it.
- After forming a hypothesis, run the cheapest experiment that could disprove it.
- Batch independent tool calls in one round. Run commands in the foreground.
- 2 failed fix attempts → STOP, report BLOCKED with your ledger.
- Under uncertainty, first do everything that doesn't depend on the answer; then state the assumption you made, or ask at the end of a turn that also delivers progress. Block only when every assumption would be unsafe.
- Before reporting done: attack your work (edge inputs, re-runs, the original success test), then re-verify with the strongest check available (tests, validator, script, screenshot, re-reading the output). "Should work" is banned — verify, or list it as NOT verified.
- Don't end on a plan, a promise, or a permission question for work already requested. End only when done or blocked on input only the requester can give.
- Report: what could NOT be verified FIRST; then conclusion; claims labeled FACT/INFERENCE/ASSUMPTION; weakest link in one line; unresolved questions last.
Success test for this task: A1-A7, C1-C5, V1-V5.
Constraints: local/synthetic only; no external side effects; no live authority inference.
Reversibility: two-way (source/test changes only; no external mutation).

## Completion report
Write worker-report.md with:
1. Acceptance IDs addressed
2. Summary
3. Evidence (<=10 inline lines or paths)
4. Confidence
5. Out-of-scope noticed
End exactly with:
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: <1–2 sentences>
Concerns/Blockers: <if any>
