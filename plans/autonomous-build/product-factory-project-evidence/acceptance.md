# Product Factory Project Evidence Probe — Acceptance

## Requirements

- **A1** Derive a deterministic, bounded project evidence plan from existing local repository metadata without network, dependency installation, browser access, credentials or publication authority.
- **A2** Recognize only strict shell-free project commands from an explicit manifest allowlist; reject shell operators, pipelines, redirects, package-manager installs and unbounded scripts.
- **A3** Execute an eligible probe only inside a temporary staging workspace, never in the registered product repository; preserve bounded timeout/output and redact secret-like output.
- **A4** Collect bounded artifact evidence and a command receipt with stable relative paths, bytes, hashes, status and `externalSideEffects: false`; record in the existing product-factory run lineage.
- **A5** Fail closed and truthfully record `NOT_EXECUTED_UNSAFE`/`FAILED` when metadata is missing or commands are not eligible; do not infer build/render success from a manifest or plan.
- **A6** Preserve existing explicit artifact path behavior and all campaign, authority, LinkedIn/JEV/ORCA, publication verification and UNKNOWN semantics.

## Constraints

- **C1** Reuse `src/product-factory.mjs`, `SeedingService.runProductFactory`, existing bounded lineage and artifact hashing; no new store/router/state machine/browser abstraction.
- **C2** Do not run scripts from real product repositories in this milestone; fixture-only eligible execution proves the staging seam.
- **C3** Do not install packages, call network services, open browser/session profiles, mutate canonical runtime or perform social/external side effects.
- **C4** Preserve user repository state and never write generated evidence into a registered product repository.

## Verification

- **V1** Focused Product Factory and runtime tests pass with zero failures.
- **V2** Tests cover deterministic plan, shell/operator rejection, staging isolation, timeout/failure, bounded artifact hashes and truthful ineligible status.
- **V3** Full Node suite passes with zero failures; existing skips are reported.
- **V4** Independent read-only review confirms no authority/browser/social/UNKNOWN drift and no source repository writes.
- **V5** Syntax, diff and JSON checks pass; canonical runtime/protected UNKNOWN state remains unchanged.
