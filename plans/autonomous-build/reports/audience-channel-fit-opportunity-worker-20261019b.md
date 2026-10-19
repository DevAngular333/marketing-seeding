# Audience/channel fit evidence hardening — worker report

Unverified first:

- Full Node suite and independent controller review were not run in this lane.

## Outcome

Hardened the existing read-only opportunity projection so explicit fit evidence is proven only when `eligible === true` and all three audience, channel, and locale dimensions are explicitly `MATCHED`. Forged or incomplete fit records now fail closed and cannot appear as opportunities. Legacy observations without a fit object remain compatible.

## Evidence

- `node --test test/opportunity-projection.test.mjs test/service.test.mjs`: 79 passed, 0 failed, 0 skipped.
- `node --check src/opportunity-projection.mjs`: passed.
- `git diff --check`: passed.

## FACT / INFERENCE / UNKNOWN

- FACT: No auth, browser, provider, live/social, or canonical runtime paths changed.
- FACT: Existing advisory flags remain unchanged.
- INFERENCE: Requiring all dimensions prevents malformed fit metadata from being treated as next-best-action evidence.
- UNKNOWN: Full suite and independent review pending.

Status: DONE_WITH_CONCERNS
