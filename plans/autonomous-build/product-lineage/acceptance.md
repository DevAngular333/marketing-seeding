# Product Lineage Milestone — Acceptance

## Requirements

- **A1** Inspect only the campaign's existing repository using bounded, allowlisted filesystem reads; never read credentials, browser state, network resources or paths outside the repository.
- **A2** Produce machine-readable evidence records and explicit product-intelligence fields only when grounded in repository evidence; unsupported fields remain null and are listed as claims the system cannot make.
- **A3** Persist the versioned product-intelligence handoff through the existing campaign store and expose it read-only through the existing dashboard.
- **A4** Persist each bounded product-factory run, its execution result, artifact hashes, repository identity and timestamps through the existing campaign store; preserve append-only run lineage with a bounded history.
- **A5** Keep factory commands allowlisted, shell-free, timeout/output bounded, redacted and external-side-effect free.
- **A6** Do not change LinkedIn/JEV/ORCA submit, authorization, grant, window, lease, idempotency or UNKNOWN semantics.
- **A7** Do not mutate canonical production state, authenticated browser state, credentials, social platforms or protected UNKNOWN executions.
- **A8** Keep SYSTEM_AGENTIC_AI Core frozen.

## Constraints

- **C1** Reuse the existing `JsonStore`, `SeedingService`, product-intelligence handoff, product-factory runner, artifact registry and dashboard projection; no duplicate store or state machine.
- **C2** Evidence reads are restricted to an explicit filename/path allowlist, size bounded and secret-like content redacted.
- **C3** Existing API response compatibility is preserved; new fields are additive.
- **C4** No live external side effect and no publication attempt.

## Verification

- **V1** Pure repository evidence scanner tests cover bounded reads, deterministic output, path containment, redaction and missing optional files.
- **V2** Product factory tests cover durable run lineage, artifact hash references, bounded history and restart persistence in an isolated fixture.
- **V3** Product-intelligence runtime/service/dashboard tests cover evidence-grounded fields and unsupported claims.
- **V4** All `src/*.mjs` pass `node --check`; `git diff --check` passes.
- **V5** Full `node --test test/*.test.mjs` exits zero with zero failures; skips are reported.
- **V6** Canonical runtime SHA/revision and protected UNKNOWN IDs are unchanged; no social mutation.
