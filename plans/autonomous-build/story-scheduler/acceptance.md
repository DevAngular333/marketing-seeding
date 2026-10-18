# Scheduler-owned product story derivation

## Requirements

- **A1** Reuse the existing `SeedingService.deriveProductIntelligenceStory`
  and `JsonStore` story collection; do not add a store, router or state
  machine.
- **A2** Accept an explicit bounded `contentBoundary.storyPolicy` on a
  campaign authorization. The policy must contain a caller-supplied CTA and
  may contain bounded disclosure/language values. Credential-like values fail
  closed.
- **A3** Queue derivation is enabled only for one current active
  `standing_autonomous` `approved_template_set` authorization with
  `allowLiveExecution === true` and an explicit story policy.
- **A4** A READY handoff and current repository lineage are still required;
  missing readiness, ambiguous authority, missing policy or source drift must
  leave the campaign without an automatically derived story or new execution
  artifacts.
- **A5** Repeated queue ticks and a fresh service instance produce one stable
  story identity. Existing template candidate/materialization controls remain
  the only path to posts, requests, windows, grants and leases.
- **A6** Historical UNKNOWN execution and uncertainty records remain
  immutable; no browser, ORCA, LinkedIn or social action is performed.

## Constraints

- **C1** `SYSTEM_AGENTIC_AI` Core and canonical runtime are read-only.
- **C2** No CTA may be inferred from campaign objective, landing URL or other
  unapproved campaign fields.
- **C3** Do not weaken authorization binding, exact target/account/profile,
  idempotency, durable submit intent or UNKNOWN quarantine semantics.
- **C4** The new scheduler behavior is local/synthetic evidence only.

## Verification

- **V1** Authorization normalization accepts and bounds the policy and keeps
  it in the authorization fingerprint.
- **V2** An eligible queue tick derives one draft story and reuses it across a
  repeated tick/restart; the existing template queue remains deterministic.
- **V3** Missing policy, incomplete handoff, ambiguous authority and source
  drift fail closed with no story/candidate/post/execution artifacts created by
  the new path.
- **V4** Full Node tests, focused scheduler/service tests, syntax checks and
  `git diff --check` pass with zero new failures.
