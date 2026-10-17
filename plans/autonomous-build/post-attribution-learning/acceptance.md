# Post attribution learning context — Acceptance

## Requirements

- **A1** Read the existing campaign `outcomeSummary.postAttributions` through
  the current learning/strategy path as a bounded advisory projection.
- **A2** Preserve per-post isolation and the existing attribution statuses;
  explicit `UNKNOWN` attribution must dominate verified, partial, or
  unobserved attribution when deriving a bounded summary, including when the
  source contains more rows than the context bound.
- **A3** Expose only deterministic, bounded post identifiers, target/channel
  identity, status, reason codes, metric coverage and safe evidence references
  for explanation and ranking context.
- **A4** Keep strategy action precedence unchanged. Attribution context may
  explain or rank an existing candidate but may not create a candidate,
  reroute a post, alter a target, or create execution authority.
- **A5** Ignore malformed, stale, cross-campaign, unsupported or secret-like
  attribution data deterministically and preserve the existing fallback. A
  post and its target/account/profile/channel must still belong to the current
  campaign state before strategy exposes the context.

## Constraints

- **C1** Reuse `src/learning.mjs`, `src/strategy.mjs`, existing outcome
  summaries, `SeedingService`, `JsonStore` and the current control cycle.
- **C2** Do not add a store, router, state machine, provider, browser action,
  publication action, account selector or authority path.
- **C3** Do not change UNKNOWN quarantine, historical UNKNOWN records,
  grants, windows, leases, requests, posts or canonical runtime state.
- **C4** Use local synthetic fixtures only; no network, browser, ORCA,
  credentials or social mutation.

## Verification

- **V1** Tests cover verified attribution context, UNKNOWN dominance including
  late rows beyond the bound, cross-post isolation, target identity drift and
  deterministic bounded context.
- **V2** Tests prove no authority/state mutation and preserve publish,
  discovery, wait and UNKNOWN strategy precedence.
- **V3** Focused and full Node test suites pass with zero failures.
- **V4** Syntax and diff checks pass.
- **V5** Canonical runtime and protected UNKNOWN records remain unchanged.
