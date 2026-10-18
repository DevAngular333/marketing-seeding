# Template Candidate Binding

## Goal

Enable a versioned, deterministic `approved_template_set` candidate to enter
the existing queue and standing execution controls without introducing a new
store, state machine, provider router or browser path.

## Requirements

- A1. Render template candidates only from one exact active campaign
  authorization, its approved claims and its required disclosures.
- A2. Persist a versioned template binding containing template identity,
  fingerprint, canonical claim IDs and exact source references.
- A3. Include the binding in candidate identity so template and generated-copy
  candidates cannot collide.
- A4. Revalidate authorization binding, template fingerprint, exact rendered
  content, source bytes, target/account/profile/URL, audience, visibility and
  policy before standing queue materialization.
- A5. Reuse existing post idempotency, readiness, execution request,
  one-time-window, grant, lease and UNKNOWN quarantine behavior.
- A6. Keep legacy candidates and non-standing/manual or ambiguous template
  authority draft-only; preserve existing approved-copy behavior.

## Constraints

- C1. No new persistence store, state machine, provider router, browser
  abstraction or LinkedIn publisher.
- C2. No browser, ORCA, LinkedIn, social or external side effect.
- C3. No canonical runtime writes and no mutation or retry of historical
  UNKNOWN executions.
- C4. `SYSTEM_AGENTIC_AI` Core remains frozen.

## Verification

- V1. Deterministic template rendering and fingerprint tests pass.
- V2. Exact template candidates queue once with one post/request/window/grant.
- V3. Tampered template, claim, source, authorization, target, content or
  contract version fails closed and creates no execution artifacts.
- V4. Repeated queue ticks and restart remain idempotent; terminal/UNKNOWN
  posts are never replayed.
- V5. Existing focused and full Node suites pass with zero failures.
