# Task — BUILD · bounded repository evidence inspection
## Identity
Run: product-lineage-20261017 · Role: BUILD · Controller: /root
Independent verifier: /root/integration_review (read-only)
Workspace: /Users/nam/Documents/marketing-seeding-integration · Work dir: plans/autonomous-build/product-lineage
Report path: plans/autonomous-build/reports/product-inspection-worker.md

## Acceptance IDs
A1, A2, A3, A8 · C1, C2, C3 · V1, V3, V4

## Read first
- plans/autonomous-build/product-lineage/acceptance.md
- src/product-intelligence.mjs
- src/product-intelligence-runtime.mjs
- src/product-factory.mjs
- test/product-intelligence.test.mjs

## Allowed to change
- src/product-repository-inspection.mjs (new)
- test/product-repository-inspection.test.mjs (new)
- plans/autonomous-build/reports/product-inspection-worker.md

## Read-only paths
All other source, tests, state and plans.

## Objective
Add a bounded repository evidence inspector that reads only an explicit allowlist of small text/manifest files inside the already-resolved repository. Return deterministic sanitized evidence suitable for the existing product-intelligence builder. Include path containment, file size and total size bounds, symlink escape rejection/skip, stable SHA-256 file identity, bounded text and credential-like redaction. Do not generate unsupported claims, invoke network access, execute commands or persist state.

## Constraints / non-goals
No browser, credentials, network, shell, publication, campaign store, schema migration, dashboard or System-Agentic changes. Do not weaken existing redaction or product-intelligence contracts.

## Routing
ROLE: BUILD · TIER: workhorse · EFFORT: high · ROUTING REASON: bounded deterministic local module.

## Authority
Local filesystem only inside fixture repositories; no external side effect. Stop if the task requires changes outside owned paths or a contract change.

## Verification
Run focused inspector tests, node --check for owned source, and git diff --check after the last change.

## Worker preamble
Success means the declared acceptance IDs are addressed and the report ends with the required Status line.

## Completion report
Include Acceptance IDs addressed, Summary, Evidence (max 10 lines or paths), Confidence, Out-of-scope noticed, then:
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: ...
Concerns/Blockers: ...
