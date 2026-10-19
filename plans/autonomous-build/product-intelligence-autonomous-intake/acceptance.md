# Product intelligence autonomous intake

## Requirements

- A1. Reuse the existing repository inspector, deterministic product intelligence builder, versioned handoff, campaign store and standing template queue; do not add a second store, provider router, state machine, browser abstraction or upstream Core change.
- A2. When an active campaign has exactly one current `standing_autonomous` authorization with `approved_template_set` and an explicit bounded `storyPolicy`, the queue may inspect the already registered product repository when no persisted product-intelligence record exists.
- A3. Persist only sanitized repository inspection lineage, evidence-grounded deterministic product intelligence and its versioned handoff; credentials/session material and arbitrary caller fields remain excluded.
- A4. Incomplete or unsupported product intelligence remains `INCOMPLETE` and keeps story/candidate/post/request/window/grant/lease creation fail-closed. A complete local document may continue through the existing story/template/materialization path only.
- A5. Repeated queue ticks and restart are idempotent: an unchanged persisted handoff is reused without duplicate product-intelligence records, stories, candidates, posts or execution artifacts.
- A6. Source drift, malformed policy, ambiguous authority, inactive campaign or missing story policy does not trigger inspection or execution artifacts.

## Constraints

- C1. No browser, ORCA, LinkedIn, network write, credentials, canonical runtime, social mutation or historical UNKNOWN mutation.
- C2. Existing campaign authorization, queue, readiness, grant, window, lease, exact identity, UNKNOWN and transport semantics remain authoritative.
- C3. No external LLM/provider dependency; deterministic local inspection only.
- C4. The feature is opt-in through an existing exact standing template story policy; no dashboard approval or per-post approval is added.

## Verification

- V1. Focused tests cover automatic inspection, incomplete fail-closed behavior, complete continuation, repeated tick/restart idempotence, source drift and authority ambiguity.
- V2. Existing product-intelligence, queue, authorization, JEV/LinkedIn, transport and UNKNOWN regressions pass.
- V3. Full Node suite, syntax, diff and UI checks pass with zero new failures.
- V4. Canonical runtime checksum/revision and historical UNKNOWN records remain unchanged.
