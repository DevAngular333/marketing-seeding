# Changes

- Reused `contentCandidateIdentity` and existing campaign authorization fingerprints.
- Revalidated persisted story grounding files through the campaign `productRepo` before materialization.
- Added fail-closed exact standing-authorization matching for destination, campaign scope, content hash, audience, visibility and validity.
- Reused existing post queue/readiness/execution request/one-time window/live grant methods for an exact standing match.
- Hardened idempotent existing-post matching with campaign, story, content hash, evidence, audience, language, visibility and authorization binding checks.
- Added regressions for standing execution control derivation and grounding-source drift.
- Added regressions proving paused, revoked and expired standing authorizations leave candidates draft-only without execution artifacts.
