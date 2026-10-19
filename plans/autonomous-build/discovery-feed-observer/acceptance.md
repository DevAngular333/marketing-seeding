# Discovery feed observer — acceptance

## Requirements

- **A1** Extend the existing public discovery observer to accept RSS and Atom
  response content types without adding a second crawler or persistence store.
- **A2** Emit bounded item-level observations with stable safe URLs, title,
  text, author, publication time and source identifiers when available.
- **A3** Preserve existing public URL safety: public DNS pinning, redirect and
  byte bounds, timeout handling, credential redaction and UNKNOWN behavior.
- **A4** Keep feed items advisory. They must flow through the existing
  normalization/deduplication/fit path and must never create authority,
  execution requests, browser actions or external writes.

## Constraints

- **C1** Reuse `src/discovery-observer.mjs`, `src/discovery.mjs` and the
  existing `SeedingService.observeDiscoveries()` seam.
- **C2** Do not add a provider router, feed scheduler, campaign store or
  platform adapter.
- **C3** Cap item extraction and text/byte sizes; malformed or unsafe item links
  fall back to the feed URL or remain UNKNOWN through the existing path.
- **C4** Do not read or mutate canonical state, browser/session material,
  credentials or external platforms during implementation or verification.

## Verification

- **V1** RSS and Atom fixture tests produce deterministic item observations.
- **V2** malformed feed, unsafe item link, oversized feed and unsupported type
  remain bounded and fail closed.
- **V3** Existing discovery observer, scheduler and full Node suites pass.
- **V4** Syntax, diff, journal JSON and UI gates remain green.
