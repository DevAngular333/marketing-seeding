# Outcome and learning aware advisory strategy — Acceptance

## Requirements

- **A1** Read the persisted campaign learning feedback through the existing
  strategy path only when it is advisory, side-effect-free, campaign-matching,
  and linked to the current outcome summary.
- **A2** Preserve the authoritative strategy order: product readiness,
  UNKNOWN quarantine, existing publishable queue, existing discovery/reply
  candidates, dynamic wait, then `do_nothing`.
- **A3** Record a bounded learning signal and outcome reference in the
  strategy decision so Mission Control can explain which current feedback was
  observed; do not expose arbitrary untrusted text.
- **A4** Ignore missing, stale, malformed, unsupported, or cross-campaign
  feedback deterministically. Learning `do_nothing` must not create a new
  quarantine.
- **A5** Preserve deterministic decision identity and bounded evidence across
  repeated derivation and process restart.

## Constraints

- **C1** Reuse `src/strategy.mjs`, `src/learning.mjs`, `src/outcome.mjs`, the
  existing `SeedingService`, `JsonStore`, and control-cycle path.
- **C2** Do not create or change posts, authority, windows, grants, leases,
  execution requests, browser actions, provider calls, publication state, or
  UNKNOWN records.
- **C3** Do not infer per-post, per-target, or per-channel performance from
  campaign aggregate outcome data.
- **C4** Keep `SYSTEM_AGENTIC_AI` Core and the LinkedIn/JEV/ORCA execution seam
  unchanged.
- **C5** Use local fixtures only; no network, browser, credentials, or social
  mutation.

## Verification

- **V1** Focused strategy/control-cycle/service tests pass with zero failures.
- **V2** Tests cover publish precedence, current feedback context, stale and
  malformed feedback, UNKNOWN dominance, and deterministic identity.
- **V3** Full Node suite passes with zero failures; skipped tests are reported.
- **V4** Syntax and diff checks pass.
- **V5** Canonical runtime and historical UNKNOWN records remain untouched.
