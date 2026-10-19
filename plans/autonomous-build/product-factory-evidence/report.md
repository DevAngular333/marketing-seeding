# Product Factory artifact evidence — Report

## Unverified first

- This milestone is local and synthetic only. It did not build, install,
  render, capture media, open a browser, call a network service, or publish.
- It does not make an artifact a publication-approved asset. Registration,
  campaign authorization, target rules, media integrity and live execution
  gates remain separate.
- Canonical service state is not changed by this branch; live LinkedIn proof
  remains blocked by missing exact authorization and ORCA executable 1.4.229 is available locally, but irreversible-submit proof remains unproven.

## Outcome

The existing Product Factory now discovers a bounded set of likely product
artifact files when the caller omits `artifactPaths`. Discovery walks only the
registered repository, sorts entries deterministically, skips generated/vendor
directories, accepts a small media/document extension allowlist, caps results
at 32 files and 16 MiB, and checks resolved paths remain inside the repository.
The existing `collectArtifactEvidence` function then hashes the candidates.

Explicit `artifactPaths` remain authoritative. The new discovery result is
stored as metadata on the existing bounded `campaign.productFactoryRuns`
lineage and does not create `state.artifacts`, posts, approvals, grants,
windows, leases or publication authority.

## Files

- `src/product-factory.mjs` — deterministic bounded candidate discovery.
- `src/service.mjs` — uses discovery only when explicit paths are absent.
- `test/product-factory.test.mjs` — deterministic, extension, directory and
  limit coverage.
- `test/product-factory-runtime.test.mjs` — persisted discovery and hash
  lineage coverage.

## Evidence class

`LOCAL_REAL` for filesystem traversal and hashing in isolated temporary
repositories; synthetic fixtures, not a real customer repository or live
platform.

## Status

`COMPLETE_LOCAL_VERIFIED` (bounded). The remaining product-factory work is
project-specific build/run/render/media orchestration and artifact lifecycle,
which is intentionally not part of this seam.
