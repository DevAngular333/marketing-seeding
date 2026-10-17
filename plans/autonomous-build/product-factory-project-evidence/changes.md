# Changes

- Added deterministic manifest parsing for the existing Product Factory.
- Restricted eligible manifest commands to relative JavaScript syntax checks.
- Added source existence, extension, traversal and symlink containment checks.
- Added temporary staging execution with generated/vendor directory filtering,
  symlink exclusion, bounded timeout/output, cleanup, and artifact hashing.
- Reused the existing `SeedingService.runProductFactory` lineage and explicit
  artifact path behavior.
- Added regression tests for unsafe commands, safe syntax checks, missing
  sources, timeout/failure, staging isolation, hashes, and truthful status.

