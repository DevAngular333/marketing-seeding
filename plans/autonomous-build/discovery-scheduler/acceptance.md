# Opt-in campaign discovery scheduler — Acceptance

## Requirements

- **A1** Persist a bounded, sanitized list of explicit public HTTP(S) discovery URLs on an existing campaign through the existing `JsonStore`/`SeedingService` boundary.
- **A2** Add an opt-in scheduler controlled by `SEEDING_DISCOVERY_POLL_MINUTES`, disabled by default and requiring at least 15 minutes when enabled; poll only campaigns with configured sources and invoke the existing read-only public observer.
- **A3** Reuse `observeDiscoveries` and `recordDiscoveries`; never create or change campaign authorizations, windows, grants, leases, execution requests, posts, browser actions, provider calls or social state.
- **A4** Expose bounded scheduler health/dashboard runtime metadata and failure summaries without secrets or fetched credential material.
- **A5** Preserve explicit UNKNOWN fetch failures and do not treat them as positive relevance evidence; a scheduler failure must not stop unrelated campaigns or the service.

## Constraints

- **C1** No second campaign store, discovery store, provider router, browser abstraction or state machine.
- **C2** No external write, login, social mutation, browser/provider execution or credential/session access.
- **C3** URL count, source text, options and runtime summaries remain bounded; reject URL credentials and unsafe destinations through the existing observer.
- **C4** Keep the scheduler disabled unless explicitly configured; local tests use injected fetch fixtures or no network.
- **C5** Keep `SYSTEM_AGENTIC_AI` Core and LinkedIn/JEV/ORCA execution contracts frozen.

## Verification

- **V1** Focused tests cover source configuration, disabled default, enabled interval validation, bounded campaign polling, error isolation and authority immutability.
- **V2** Existing observer/discovery/service/server tests remain green.
- **V3** Full Node suite, syntax and diff checks pass with zero failures.
- **V4** Canonical runtime schema/revision/hash and protected UNKNOWN IDs remain unchanged.
