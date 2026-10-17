# Independent Verification — Product Factory Project Evidence Probe

Date: 2026-10-18  
Worktree: `/Users/nam/Documents/marketing-seeding-integration` (`integration/autonomous-build`)  
Scope: read-only review of the uncommitted Product Factory safety patch against `plans/autonomous-build/product-factory-project-evidence/acceptance.md`.

## Unverified first

- No real product repository was executed; eligible execution was fixture-only as required.
- No browser, credentials, network, social platform, authority, publication or canonical UNKNOWN state was accessed.
- Full Node suite completed locally; live external-side-effect behavior remains unverified by design.

## Findings

- Manifest handling is fail-closed and explicit: only `build`, `test`, `render`, and `validate` keys are considered; only `node --check <relative .js|.mjs>` commands are eligible. Shell operators, package managers, interpreters, arbitrary scripts, traversal, absolute paths and missing sources are rejected into `rejected` with `NOT_EXECUTED_UNSAFE` when no eligible steps remain.
- Command execution remains argv-only, `shell:false`, bounded by timeout/output limits, repository-contained, and restricted to internal syntax/static probes. The prior broad binary allowlist is removed.
- Eligible probes copy the repository to a unique temporary `/tmp` staging directory, exclude generated/vendor directories and symlinks, run there, collect bounded artifact hashes there, then remove staging in `finally`. Fixture test confirms source file unchanged and `externalSideEffects:false`.
- Missing/unsafe manifests do not run a command and are reported truthfully; failed/timeout probes remain failed/timeout rather than implying success. Secret-like output is redacted by existing collector/runner paths.
- `SeedingService.runProductFactory` reuses existing campaign-owned run lineage and artifact collector; no posts, execution requests, authorization/grant/window/lease, browser, publication or UNKNOWN semantics are touched.

## Verification commands

```text
node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs
45 total, 45 passed, 0 failed, 0 skipped

node --test test/*.test.mjs
379 total, 377 passed, 0 failed, 2 skipped

node --check src/product-factory.mjs
PASS
node --check src/service.mjs
PASS
git diff --check
PASS
```

## Acceptance matrix

| Requirement | Result | Evidence |
|---|---|---|
| A1 | PASS | Deterministic bounded plan from local package metadata; no network/dependency install/browser/authority. |
| A2 | PASS | Explicit manifest keys and strict shell-free relative JavaScript syntax-check allowlist; unsafe commands rejected. |
| A3 | PASS | Eligible probe runs only in temporary staging, with timeout/output bounds and cleanup. |
| A4 | PASS | Existing artifact hashing and product-factory run lineage reused; receipts/artifacts carry bounded paths/hashes and `externalSideEffects:false`. |
| A5 | PASS | Missing/unsafe metadata returns `NOT_EXECUTED_UNSAFE`; failed/timeout statuses are preserved. |
| A6 | PASS | Existing explicit artifact behavior and campaign/authority/LinkedIn/JEV/ORCA/publication/UNKNOWN semantics unchanged. |
| C1-C4 | PASS | Existing modules/store/lineage reused; fixture-only execution; no repository/canonical/external writes. |
| V1 | PASS | Focused Product Factory/runtime/service gate 45/45. |
| V2 | PASS | Tests cover deterministic plan, shell rejection, staging isolation, timeout/failure, hashes/redaction and truthful ineligible status. |
| V3 | PASS | Full Node suite 379 total, 377 passed, 0 failed, 2 skipped. |
| V4 | PASS (bounded) | Independent source review finds no authority/browser/social/UNKNOWN drift; canonical runtime unchanged. |
| V5 | PASS | Syntax, diff and state integrity checks pass. Canonical schema 8 revision 194 SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`; protected UNKNOWN IDs unchanged. |

## Verdict

**PASS (bounded)** — Product Factory project evidence now fails closed on unsafe manifests and isolates eligible probes in temporary staging, preserving bounded receipts, artifact evidence, campaign lineage and all publication safety semantics.

**Status: VERIFIED — PRODUCT FACTORY SAFETY PASS; 45/45 FOCUSED; FULL SUITE 377/379; NO AUTHORITY/BROWSER/SOCIAL/UNKNOWN DRIFT; NO EXTERNAL SIDE EFFECTS.**
