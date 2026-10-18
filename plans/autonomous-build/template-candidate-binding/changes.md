# Changes

- Added `TEMPLATE_CANDIDATE_CONTRACT_VERSION = 1` and deterministic template
  claim/source/fingerprint helpers in `src/content-foundation.mjs`.
- Added deterministic `approved_template_set` candidate derivation with exact
  claim, disclosure, source, policy and credential-safety checks.
- Extended candidate identity with the complete template binding.
- Added fail-closed template revalidation to
  `SeedingService.materializeContentCandidate` and persisted the binding on the
  post lineage.
- Allowed the existing queue scheduler to process exact standing template
  candidates while keeping legacy/manual/ambiguous candidates draft-only.
- Added operator-only `POST /api/campaigns/:campaignId/template-content-candidates`.
- Added service regressions for positive queueing, restart/idempotency, source
  and content tampering, plus HTTP role authorization coverage.
- Updated the campaign authorization contract to require a claim placeholder in
  every approved template and to preserve existing disclosure/token checks.
