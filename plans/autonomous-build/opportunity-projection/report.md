# Read-only opportunity projection

Implemented `src/opportunity-projection.mjs` and focused tests. The projection
turns existing discovery records into bounded, deterministic Mission Control
opportunity rows with score, evidence, and reasons. It is advisory only and
never creates authorization, dispatches work, or calls a provider.

Evidence: `node --test test/opportunity-projection.test.mjs` — 3 passed.

Limitations: this is not channel discovery, engagement execution, or live
platform support. It consumes existing normalized discovery observations.
