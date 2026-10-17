# Product Factory artifact evidence — Changes

- Added `discoverArtifactCandidates()` with deterministic sorted traversal,
  extension allowlist, ignored generated/vendor directories, depth/file/byte
  bounds, realpath containment and `externalSideEffects: false` metadata.
- Updated `SeedingService.runProductFactory()` to preserve explicit artifact
  paths and otherwise collect discovered candidates through the existing hash
  collector.
- Added focused unit and runtime persistence tests.
- No changes to browser, LinkedIn, JEV, ORCA, authority, execution, receipt,
  publication or UNKNOWN contracts.
