# Changes

- Reused `buildProductIntelligence` and normalized repository evidence to derive
  bounded descriptive candidates when a required field is absent.
- Accepted a safe `package.json` description as the deterministic
  `WHAT_IS_IT` candidate when present.
- Added field-specific sentence markers and deterministic ranking for problem,
  differentiator and audience descriptions.
- Preserved valid explicit evidence-grounded claims as authoritative and kept
  invalid or unsupported claims in `CLAIMS_WE_CANNOT_MAKE`.
- Retained credential/session redaction, stable document hashing and existing
  handoff/service/dashboard persistence contracts.
