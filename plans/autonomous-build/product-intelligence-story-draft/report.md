# Product Intelligence to Story Draft

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN  
**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`  
**Evidence class:** LOCAL / SYNTHETIC

## Outcome

The integration branch now derives one deterministic, evidence-grounded
`draft` story from a campaign's persisted READY product-intelligence handoff.
The helper selects the four required product fields, requires distinct
supported claims and evidence references, derives a title, angle and audience,
and binds a stable story identity to the handoff hash, CTA, disclosure, claim
IDs and current repository source hashes.

The service revalidates the persisted handoff, repository inspection hash and
record metadata, rebuilds normalized evidence from the current allowlisted
repository files, and compares the current bytes before persistence. Repeated
calls and a fresh `JsonStore` return one story row. Disclosure and CTA inputs
are bounded and credential-like values fail closed.

The story remains `draft` and this method is not called by the queue or control
cycle. It creates no authorization, post, execution request, one-time window,
grant, lease, browser action or provider action.

## Review

Independent read-only review: **REWORK findings resolved**. The review required
handoff validation, fresh inspection/evidence lineage, same-file multi-reference
handling and safe disclosure persistence. Those controls and regressions are
now present.

## Limitations

- This is deterministic local derivation, not production LLM content.
- The caller still supplies the CTA and may supply a disclosure; the system
  does not invent a growth strategy or external audience research.
- No live browser, ORCA, LinkedIn, social or canonical runtime action was
  attempted.
