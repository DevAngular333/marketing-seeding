# Autonomous product-intelligence intake

## Result

`PASS (LOCAL_REAL_ISOLATED_STORE)`.

The standing template queue can now inspect an already registered campaign
repository when an active campaign has exactly one current
`standing_autonomous` / `approved_template_set` authorization with an explicit
bounded `storyPolicy` and no persisted product-intelligence handoff. The queue
reuses the existing repository inspector, deterministic evidence/claim builder,
versioned handoff, story derivation, template candidate binding and standing
execution controls.

The intake is bounded by the authorization's exact approved source paths and
SHA-256 values. It persists sanitized inspection lineage only. Incomplete
intelligence, source drift, inactive or ambiguous authority, and missing policy
remain draft-only and create no execution artifacts.

## Evidence

- Implementation: `src/service.mjs`
- Existing inspector and handoff: `src/product-repository-inspection.mjs`,
  `src/product-intelligence.mjs`, `src/product-intelligence-runtime.mjs`
- Regression coverage: `test/service.test.mjs`
- Independent review: `plans/autonomous-build/reports/verify-20261019-product-intelligence-autonomous-intake.md`

## Classification

- Autonomous intake: `IMPLEMENTED`, `LOCAL_VERIFIED`
- Product intelligence: deterministic local repository evidence only
- Story/candidate path: existing draft/standing queue path, locally verified
- Live LinkedIn publication: `UNPROVEN`; no browser or social action occurred
