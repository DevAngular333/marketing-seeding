# Product Factory artifact evidence — Acceptance

## Requirements

- **A1** Discover candidate product artifacts from the registered repository
  using a deterministic, read-only and bounded filesystem walk.
- **A2** Recognize only a small allowlist of useful media/document extensions,
  skip generated/vendor/cache directories, and reject symlink escapes.
- **A3** Reuse `collectArtifactEvidence` for hashes and preserve explicit
  `artifactPaths` as the caller's authoritative override.
- **A4** Persist discovery metadata and collected artifact evidence inside the
  existing bounded `productFactoryRuns` lineage; do not add a store or state
  machine.
- **A5** Keep the factory local-only: no network, browser, credentials,
  dependency installation, arbitrary shell, publication authority or social
  mutation.

## Constraints

- **C1** Reuse `src/product-factory.mjs`, `SeedingService.runProductFactory`,
  `JsonStore` and existing artifact hashing.
- **C2** Preserve command allowlisting, timeout/output bounds, redaction,
  campaign ownership and restart-safe run lineage.
- **C3** Do not change LinkedIn/JEV/ORCA, transport, authorization, grants,
  windows, leases, submit intent, publication verification or UNKNOWN state.
- **C4** Do not install dependencies or execute project build/render commands
  in this milestone.

## Verification

- **V1** Focused product-factory tests pass with zero failures.
- **V2** Full Node suite passes with zero failures; skips are reported.
- **V3** Syntax, diff and JSON parse checks pass.
- **V4** Candidate discovery is deterministic, bounded, contained and
  symlink-safe.
- **V5** Canonical runtime and protected UNKNOWN records remain unchanged.
