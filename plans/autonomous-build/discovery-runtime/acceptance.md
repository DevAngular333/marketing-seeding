# Public discovery observer — Acceptance

## Requirements

- **A1** Fetch only explicit public HTTP(S) discovery URLs supplied by the campaign/runtime caller.
- **A2** Reject unsafe schemes, credentials in URLs, loopback/private/link-local/reserved destinations and redirects that leave the public host policy.
- **A3** Bound URL count, response bytes, redirect hops, timeout and extracted text; never send cookies, bearer headers or browser/session material.
- **A4** Normalize fetched observations through the existing discovery module, preserve provenance and deduplicate through the existing campaign persistence path.
- **A5** Persist observations only; do not create posts, approvals, campaign authorizations, grants, windows, leases, execution requests or browser/provider actions.
- **A6** Expose an additive automation-safe collection endpoint and keep the optional scheduler disabled by default unless explicitly configured.

## Constraints

- **C1** Reuse `normalizeDiscovery`, `processDiscoveries`, `SeedingService.recordDiscoveries` and `JsonStore`; no second discovery store or state machine.
- **C2** Read-only network only; no login, form submission, social mutation, credential access or external write action.
- **C3** Keep `SYSTEM_AGENTIC_AI` Core and LinkedIn/JEV/ORCA execution contracts frozen.
- **C4** Unknown, blocked and unsupported observations remain explicit; fetch failure does not become positive relevance evidence.
- **C5** Keep all fetched content bounded and redact credential-like material before persistence.

## Verification

- **V1** Unit tests cover URL safety, SSRF/private-address rejection, bounds, redirects, extraction and failure classification.
- **V2** Service/endpoint tests prove persistence uses existing discovery state and authority collections remain unchanged.
- **V3** Full Node suite, syntax and diff checks pass with zero failures.
- **V4** Canonical runtime hash/revision and protected UNKNOWN records remain unchanged.
