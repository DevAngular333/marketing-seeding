# Content Candidate Authorization Binding

## Requirements

- A1. Reuse the existing materialization, campaign authorization, queue, readiness, execution request, one-time window and standing grant contracts.
- A2. Bind a materialized candidate only to one exact active `standing_autonomous` authorization whose campaign, destination, account/profile, target URL, content hash, audience, visibility, validity and binding fingerprint match.
- A3. Revalidate every story grounding source against the registered campaign repository before creating or binding a post.
- A4. Derive the existing queue/readiness/request/window/grant path without per-post approval and without creating a second state machine or store.
- A5. Preserve idempotency, exact lineage, duplicate protection and UNKNOWN quarantine.
- A6. Keep non-matching, expired, manual, ambiguous or multiply-active authorization cases draft-only or fail closed.

## Constraints

- C1. No live browser, ORCA, LinkedIn, social or external side effect.
- C2. Do not mutate canonical runtime or historical UNKNOWN executions.
- C3. Do not add a provider, browser, campaign store, router or state machine.
- C4. System-Agentic Core remains frozen.

## Verification

- V1. Focused service/server suite passes with standing binding and source drift regressions.
- V2. Full Node suite has zero failures.
- V3. Syntax and diff checks pass.
- V4. Existing execution, grant, window, readiness, idempotency and UNKNOWN tests remain green.
