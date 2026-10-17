# Per-post outcome attribution projection — Acceptance

## Requirements

- **A1** Derive a deterministic, bounded `postAttributions` projection from
  the existing campaign outcome sources and append it to the existing outcome
  summary. Keep `schemaVersion: 1`, `JsonStore`, and `SeedingService`.
- **A2** Use explicit links only: post, target, execution receipt/request,
  publication attempt/uncertainty, metric snapshot, interaction/reply, and
  post-linked conversion. Campaign-only conversions remain unassigned.
- **A3** Use status precedence `UNKNOWN` > `VERIFIED` > `PARTIAL` >
  `UNOBSERVED`. `VERIFIED` requires the existing canonical publication
  evidence identity checks; command completion, acceptance, metrics, or a
  permalink alone never qualify.
- **A4** Snapshot target, channel, account, and profile identity. Missing
  identity fails closed and cannot produce a verified attribution.
- **A5** Select the latest metric snapshot per post deterministically,
  including deterministic tie handling, and bound IDs, evidence, and records.
- **A6** Keep attribution advisory and read-only. It must not create or alter
  authority, windows, grants, leases, requests, receipts, posts, publication
  attempts, or UNKNOWN records.

## Constraints

- **C1** Reuse `src/outcome.mjs`, the existing publication evidence contract,
  `SeedingService.deriveOutcomeSummary`, `appendOutcomeSummary`, and
  `JsonStore`.
- **C2** Do not add a store, router, state machine, browser abstraction,
  provider, account selector, strategy rerouting, or live execution path.
- **C3** Use local synthetic state only. No browser, ORCA, credentials,
  network, or external/social side effect.
- **C4** Historical UNKNOWN records and canonical runtime state are immutable
  for this milestone.

## Verification

- **V1** Focused outcome/service/control-cycle regressions pass with zero
  failures.
- **V2** Tests cover verified post metrics, cross-post isolation, deterministic
  latest metric/tie selection, UNKNOWN dominance, accepted-but-unverified
  publication, missing identity fail-closed behavior, campaign-only
  conversions, same-hour identity, bounds, restart/idempotent append, and
  unchanged authority/UNKNOWN records.
- **V3** Full Node suite passes with zero failures; skipped tests are reported.
- **V4** Syntax and diff checks pass.
