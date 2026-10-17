# Task — BUILD · bounded factory result lineage module
## Identity
Run: product-lineage-20261017 · Role: BUILD · Controller: /root
Independent verifier: /root/integration_review (read-only)
Workspace: /Users/nam/Documents/marketing-seeding-integration · Work dir: plans/autonomous-build/product-lineage
Report path: plans/autonomous-build/reports/factory-lineage-worker.md

## Acceptance IDs
A4, A5, A6 · C1, C2, C4 · V2, V4

## Read first
- plans/autonomous-build/product-lineage/acceptance.md
- src/product-factory.mjs
- test/product-factory.test.mjs
- src/service.mjs (read-only context)

## Allowed to change
- src/product-factory.mjs
- test/product-factory.test.mjs
- plans/autonomous-build/reports/factory-lineage-worker.md

## Read-only paths
All other source, tests, state and plans.

## Objective
Review and, only where needed, expose a small helper for sanitizing/bounding a product-factory execution result before the existing SeedingService persists a run. Preserve allowlisted shell-free execution, timeout/output bounds, redaction and externalSideEffects=false. Do not change command semantics or add a second runner.

## Constraints / non-goals
No service/store/schema/API/browser/auth/LinkedIn changes. No network or external side effects. Do not add an alternate artifact registry. Stop and report CONTRACT_CHANGE_REQUIRED if persistence requires a shared contract change.

## Routing
ROLE: BUILD · TIER: workhorse · EFFORT: high · ROUTING REASON: narrow helper review with safety implications.

## Authority
Local fixture repositories only. No canonical state or external account access.

## Verification
Run focused product-factory tests, node --check for owned source, and git diff --check after the last change.

## Worker preamble
Success means the declared acceptance IDs are addressed and the report ends with the required Status line.

## Completion report
Include Acceptance IDs addressed, Summary, Evidence (max 10 lines or paths), Confidence, Out-of-scope noticed, then:
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
Concerns/Blockers: ...
