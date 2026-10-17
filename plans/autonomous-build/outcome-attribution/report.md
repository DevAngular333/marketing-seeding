# Per-post outcome attribution projection

**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`  
**Result:** `COMPLETE_LOCAL_VERIFIED`

## Unverified first

- No browser, ORCA, credential, network, canonical runtime or external
  platform was accessed.
- No publication, comment, like, follow, message or other social mutation
  occurred.
- This projection does not enable adaptive strategy rerouting, execution
  authority, account selection or live publication.

## Outcome

The existing campaign outcome summary now includes bounded `postAttributions`.
Each record is derived only from explicit post links to the existing target,
execution receipt/request, publication attempt/uncertainty, metric snapshot,
interaction/reply and post-linked conversion collections. Campaign-only
conversions are listed as `unassignedConversionIds` and are never allocated to
a post.

Attribution status precedence is `UNKNOWN` > `VERIFIED` > `PARTIAL` >
`UNOBSERVED`. `VERIFIED` requires complete target identity and the existing
canonical publication evidence checks: confirmed receipt or strong post
verification, account/target/profile match, content hash match, stable URL and
verified timestamp. Command completion, acceptance, a permalink, metrics or
post status alone cannot produce `VERIFIED`.

Metric selection is deterministic by capture time and stable ID tie ordering.
Records, IDs and references are bounded and secret-like references are
excluded. `appendOutcomeSummary` remains idempotent and the summary schema
remains version 1.

## Evidence

- Focused outcome/control-cycle/learning/service gate: **42 passed, 0 failed,
  0 skipped**.
- Full Node suite: **388 total, 386 passed, 0 failed, 2 skipped**.
- `node --check src/outcome.mjs`: passed.
- `git diff --check`: passed.
- Independent read-only review: **ACCEPT (bounded)**.
- Canonical runtime read-only recheck: schema 8, revision 194, SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`;
  four protected UNKNOWN records unchanged.

## Safety

The projection is pure and advisory. It does not import or call authority,
browser, provider, publication, account selection or dispatch code. Tests
cover UNKNOWN dominance, explicit-link isolation, accepted-but-unverified
results, missing identity, campaign-only conversions, deterministic latest
metrics, bounds and restart/idempotent summary append.

## Next seam

Use this evidence as an input contract for a later adaptive next-best-action
milestone. That milestone must keep attribution advisory until policy defines
how measured post/channel/account outcomes may safely influence bounded
authority.
