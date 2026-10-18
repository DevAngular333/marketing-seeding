# Dry-Run Queue Handoff

## Objective

Prove a bounded local orchestration handoff from an explicitly marked
rehearsal candidate to the existing JEV dry-run queue without creating live
authority or external side effects.

## Acceptance requirements

- A1. Provide one provider-neutral service method on the existing
  `SeedingService` that scans only explicitly marked rehearsal candidates and
  materializes at most one exact dry-run execution request per candidate.
- A2. Require explicit rehearsal metadata and exact campaign/story/template/
  candidate/target/content lineage; reject missing, stale, malformed or
  mismatched lineage fail-closed.
- A3. Reuse existing `JsonStore`, execution request, lease, receipt and
  `JevExecutionWorker` contracts; do not add a store, router, browser
  abstraction, LinkedIn publisher or state machine.
- A4. Persist both top-level and nested `dryRun: true`, keep the post/request
  in the dry-run path, and never create or consume a live authorization,
  one-time window, live grant, publication evidence or live execution lease.
- A5. Make repeated ticks and restart idempotent: one candidate identity maps
  to one dry-run request and a completed request is never redispatched.
- A6. Reuse the existing autonomous dry-run worker so the handoff reaches a
  `DRY_RUN_COMPLETE` receipt when local fixture readiness permits.
- A7. Expose only bounded read-only rehearsal counters/reasons if runtime
  projection is needed; do not add a dashboard control or approval step.

## Constraints

- C1. No ORCA, browser, network, LinkedIn, social mutation, credential or
  canonical production state access.
- C2. Historical UNKNOWN executions and uncertainty records are immutable; no
  reconciliation or retry is introduced.
- C3. Never infer rehearsal authority from a live standing authorization. The
  rehearsal flag must be explicit and narrower than normal execution scope.
- C4. Live queue scheduling semantics remain unchanged. Live rows remain
  excluded from the rehearsal selector.
- C5. Scope is limited to the existing marketing-seeding integration branch;
  SYSTEM_AGENTIC_AI Core remains frozen.

## Verification criteria

- V1. Focused service/JEV tests cover valid handoff, idempotent repeat and
  restart, malformed or stale lineage, live-row exclusion and no live-control
  consumption.
- V2. A local fixture handoff reaches one dry-run receipt with
  `DRY_RUN_COMPLETE` and no publication evidence when readiness is valid.
- V3. Full existing Node suite has zero failures and no new skips.
- V4. Source syntax, JSON journal validation and `git diff --check` pass.
- V5. An independent read-only review inspects the final diff and reruns the
  focused and full gates after the last change.
