# Dependency-independent Product Definition of Done Audit — 2026-10-19

## Scope and safety

Read-only audit of `/Users/nam/Documents/marketing-seeding-integration`, branch `integration/autonomous-build`, HEAD `5519b80`. No source edit, canonical state mutation, browser/session access, credential access, live publish, or external side effect occurred.

## Verification

Focused dependency-independent gate:

```text
node --test test/product-intelligence.test.mjs test/product-factory.test.mjs test/discovery.test.mjs test/strategy.test.mjs test/learning.test.mjs test/service.test.mjs test/server.test.mjs
```

Result: **145 passed, 0 failed, 0 skipped**.

The current branch journal records the full suite at **520 total, 518 passed, 0 failed, 2 skipped**; UI typecheck/build are also recorded passing.

## Current implementation status

| Lane | Current evidence | Status |
|---|---|---|
| Product intelligence/evidence | Repository inspection, grounded fields, claim/source hashes, READY/INCOMPLETE handoff, draft story derivation, dashboard projection | LOCAL-VERIFIED / bounded |
| Product Factory | Safe classifier, static/syntax checks, staging, hashing/redaction, evidence projection, fail-closed sandbox preflight | LOCAL-VERIFIED; arbitrary build/render blocked by missing audited sandbox |
| Discovery | Normalization, deduplication, classification, relevance scoring, persisted observations, opt-in HTTP observer/scheduler, discovery-fit checks | LOCAL-VERIFIED; no autonomous platform crawler/search |
| Strategy/learning | Deterministic advisory actions, outcome attribution, metric assessment, UNKNOWN dominance, bounded learning context | LOCAL-VERIFIED; no authority-rerouting or adaptive execution |
| Metrics | Idempotent official collectors, retry handling, checkpoint projection, dashboard pulse | LOCAL-VERIFIED fixtures; no live provider proof |
| Restart/recovery | Atomic state, leases, UNKNOWN quarantine, isolated dry-run restart soak | LOCAL-VERIFIED; no machine reboot/long-duration/live-submit recovery |
| Mission Control | Read-only projections for account/runtime, opportunities, continuity, product evidence, execution timeline, blockers and permalink | LOCAL-VERIFIED; observer can see counts/status but not all reasoning details |

## Concrete safe gaps

### Gap 1 — Mission Control does not expose bounded discovery opportunity evidence

The API already projects `discoveryOpportunities`, but `ui/src/App.tsx` currently renders only the count and a generic message (`Discovery opportunities` card). An observer cannot inspect the opportunity's normalized source, relevance score, matched fit, classification, or explicit reason codes from Mission Control.

**Safe implementation boundary:** read-only UI rendering of an allowlisted, bounded list already present in the dashboard response. No new route, store, scheduler, authority, account selection, browser call, or external action.

**Acceptance criteria:**

- Render at most 5 normalized opportunity rows.
- Show source/host, bounded title/summary, score, classification, fit status, and eligibility/reason code.
- Keep URLs sanitized by existing UI safe-link helper; bound text and never render credentials/tokens/cookies.
- Empty/UNKNOWN and blocked opportunities remain explicit; no action button or approval control.
- Existing UI typecheck/build and full Node tests remain passing.

### Gap 2 — Mission Control does not expose claim-to-evidence detail

The API already projects `productIntelligence`, including bounded handoff/readiness and evidence/claim lineage, but the UI currently renders only READY count and latest factory metadata. The observer cannot see which `WHAT_IS_IT`, `WHAT_PROBLEM_DOES_IT_SOLVE`, `WHY_IS_IT_BETTER`, and `WHO_NEEDS_IT` fields are READY or which source references support them.

**Safe implementation boundary:** read-only UI projection of already-persisted, allowlisted claim IDs/source paths/hashes. No new claim generation, provider call, campaign mutation, authorization, or publication path.

**Acceptance criteria:**

- Render at most 4 intelligence fields per campaign and at most 3 source references per field.
- Show field readiness and claim/evidence IDs, with relative source paths and hashes only; omit evidence body text unless existing bounded projection explicitly supplies it.
- Display INCOMPLETE/UNKNOWN as such and preserve unsupported-claim boundaries.
- No UI control can approve a claim, create a story, or dispatch a post.
- Existing UI typecheck/build and full Node tests remain passing.

## Why these are safe and dependency-independent

Both gaps are read-model/UI observability improvements over existing persisted projections. They do not touch frozen System-Agentic Core, campaign authority, account/profile binding, ORCA transport, durable submit intent, UNKNOWN quarantine, Product Factory execution, live metric providers, or external platform actions.

They improve the required dashboard role (**OBSERVE / UNDERSTAND / STEER**) without turning the dashboard into a per-action approval console.

## Explicitly not selected for implementation in this audit

- Account selector/failover: requires a new authority-owned contract; unsafe to add as a UI/read-model shortcut.
- Product Factory arbitrary build/render: blocked by missing independently audited sandbox.
- Live metrics: requires provider permissions/network/authenticity proof.
- LinkedIn publish/verification: requires fresh exact authorization and real irreversible evidence.

## Recommendation

Implement the two read-only Mission Control detail projections as one bounded UI milestone, then rerun UI typecheck/build and the full Node suite. Keep all live publishing/authentication blockers unchanged.
